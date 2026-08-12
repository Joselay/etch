use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WatcherState {
    inner: Mutex<HashMap<PathBuf, ActiveWatcher>>,
}

struct ActiveWatcher {
    watcher: Option<RecommendedWatcher>,
    worker: Option<JoinHandle<()>>,
}

impl Drop for ActiveWatcher {
    fn drop(&mut self) {
        self.watcher.take();
        if let Some(worker) = self.worker.take() {
            let _ = worker.join();
        }
    }
}

#[derive(Default, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct RepoChange {
    path: String,
    head: bool,
    refs: bool,
    index: bool,
    worktree: bool,
}

impl RepoChange {
    fn any(&self) -> bool {
        self.head || self.refs || self.index || self.worktree
    }

    fn merge(&mut self, other: &Self) {
        self.head |= other.head;
        self.refs |= other.refs;
        self.index |= other.index;
        self.worktree |= other.worktree;
    }
}

fn classify_git_path(path: &Path, git_dir: &Path) -> RepoChange {
    let mut change = RepoChange::default();
    let Ok(relative) = path.strip_prefix(git_dir) else {
        return change;
    };
    let Some(name) = relative
        .components()
        .next()
        .and_then(|part| part.as_os_str().to_str())
    else {
        return change;
    };
    match name {
        "HEAD" => change.head = true,
        "refs" | "packed-refs" | "FETCH_HEAD" | "ORIG_HEAD" => change.refs = true,
        "index" => {
            change.index = true;
            change.worktree = true;
        }
        _ => {}
    }
    change
}

fn classify(path: &Path, root: &Path, git_dir: &Path, common_dir: &Path) -> RepoChange {
    if path.starts_with(git_dir) {
        return classify_git_path(path, git_dir);
    }
    if path.starts_with(common_dir) {
        return classify_git_path(path, common_dir);
    }

    let mut change = RepoChange::default();
    let Ok(relative) = path.strip_prefix(root) else {
        return change;
    };
    let first = relative
        .components()
        .next()
        .and_then(|part| part.as_os_str().to_str());
    if matches!(
        first,
        Some(
            ".git"
                | "node_modules"
                | "target"
                | "dist"
                | "build"
                | "coverage"
                | "out"
                | ".next"
                | ".turbo"
                | ".cache"
                | ".venv"
        )
    ) {
        return change;
    }
    change.worktree = true;
    change
}

pub fn watch(app: AppHandle, state: &WatcherState, path: &Path) -> Result<(), String> {
    let mut active = state.inner.lock().map_err(|e| e.to_string())?;
    let key = path.to_path_buf();
    if active.contains_key(&key) {
        return Ok(());
    }

    let repo = gix::open(path).map_err(|e| e.to_string())?;
    let root = path.to_path_buf();
    let git_dir = repo.git_dir().to_path_buf();
    let common_dir = repo.common_dir().to_path_buf();
    let path_string = path.to_string_lossy().to_string();
    let pending = Arc::new(Mutex::new(RepoChange {
        path: path_string.clone(),
        ..RepoChange::default()
    }));
    let (wake_tx, wake_rx) = mpsc::sync_channel(1);
    let callback_pending = Arc::clone(&pending);
    let callback_root = root.clone();
    let callback_git_dir = git_dir.clone();
    let callback_common_dir = common_dir.clone();
    let mut watcher = RecommendedWatcher::new(
        move |result: Result<Event, notify::Error>| {
            let Ok(event) = result else {
                return;
            };
            let mut batch = RepoChange::default();
            for event_path in &event.paths {
                batch.merge(&classify(
                    event_path,
                    &callback_root,
                    &callback_git_dir,
                    &callback_common_dir,
                ));
            }
            if !batch.any() {
                return;
            }
            if let Ok(mut change) = callback_pending.lock() {
                change.merge(&batch);
            }
            let _ = wake_tx.try_send(());
        },
        Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(&root, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;
    if !common_dir.starts_with(&root) {
        watcher
            .watch(&common_dir, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
    }
    if !git_dir.starts_with(&root) && !git_dir.starts_with(&common_dir) {
        watcher
            .watch(&git_dir, RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
    }

    let worker = std::thread::Builder::new()
        .name("etch repo watcher".to_string())
        .spawn(move || {
            const DEBOUNCE: Duration = Duration::from_millis(600);
            while wake_rx.recv().is_ok() {
                while wake_rx.recv_timeout(DEBOUNCE).is_ok() {}
                let emitted = {
                    let Ok(mut change) = pending.lock() else {
                        break;
                    };
                    let emitted = change.clone();
                    *change = RepoChange {
                        path: path_string.clone(),
                        ..RepoChange::default()
                    };
                    emitted
                };
                if emitted.any() {
                    let _ = app.emit("repo-changed", emitted);
                }
            }
        })
        .map_err(|e| e.to_string())?;

    active.insert(
        key,
        ActiveWatcher {
            watcher: Some(watcher),
            worker: Some(worker),
        },
    );
    Ok(())
}

pub fn unwatch(state: &WatcherState, path: &Path) -> Result<(), String> {
    state.inner.lock().map_err(|e| e.to_string())?.remove(path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_worktree_and_generated_paths() {
        let root = Path::new("/repo");
        let git = root.join(".git");
        assert!(classify(&root.join("src/main.rs"), root, &git, &git).worktree);
        assert!(!classify(&root.join("target/debug/app"), root, &git, &git).any());
    }

    #[test]
    fn classifies_repository_metadata() {
        let root = Path::new("/repo");
        let git = root.join(".git");
        assert!(classify(&git.join("HEAD"), root, &git, &git).head);
        assert!(classify(&git.join("refs/heads/main"), root, &git, &git).refs);
        let index = classify(&git.join("index"), root, &git, &git);
        assert!(index.index && index.worktree);
    }

    #[test]
    fn classifies_linked_worktree_metadata() {
        let root = Path::new("/worktree");
        let common = Path::new("/repo/.git");
        let git = common.join("worktrees/worktree");
        assert!(classify(&git.join("HEAD"), root, &git, common).head);
        assert!(classify(&common.join("refs/heads/main"), root, &git, common).refs);
    }
}
