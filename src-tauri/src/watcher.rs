use std::collections::HashMap;
use std::path::{Component, Path, PathBuf};
use std::sync::{mpsc, Arc, Mutex};
use std::thread::JoinHandle;
use std::time::Duration;

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

#[derive(Default)]
pub struct WatcherState {
    pub inner: Mutex<HashMap<PathBuf, ActiveWatcher>>,
}

pub struct ActiveWatcher {
    // Option lets Drop stop the OS watcher (and disconnect its callback) before
    // waiting for the aggregation thread.
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
    state: bool,
    stash: bool,
    config: bool,
    bisect: bool,
}

impl RepoChange {
    fn any(&self) -> bool {
        self.head
            || self.refs
            || self.index
            || self.worktree
            || self.state
            || self.stash
            || self.config
            || self.bisect
    }
    fn merge(&mut self, o: &RepoChange) {
        self.head |= o.head;
        self.refs |= o.refs;
        self.index |= o.index;
        self.worktree |= o.worktree;
        self.state |= o.state;
        self.stash |= o.stash;
        self.config |= o.config;
        self.bisect |= o.bisect;
    }
}

fn classify(path: &Path, root: &Path) -> RepoChange {
    let mut c = RepoChange::default();
    let Ok(rel) = path.strip_prefix(root) else {
        return c;
    };
    let mut comps = rel.components();
    let first = comps.next();
    let inside_git = matches!(first, Some(Component::Normal(s)) if s == ".git");
    if !inside_git {
        // Drop high-churn generated trees before they enter the debounce
        // queue. Filtering them only after debouncing can retain thousands of
        // events and is a major CPU/memory cost during builds.
        let ignored = match first {
            Some(Component::Normal(s)) => matches!(
                s.to_str(),
                Some(
                    "node_modules"
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
            ),
            _ => false,
        };
        if ignored {
            return c;
        }
        c.worktree = true;
        return c;
    }
    let rest: Vec<_> = comps.collect();
    if rest.is_empty() {
        return c;
    }
    let first_name = match &rest[0] {
        Component::Normal(s) => s.to_string_lossy().to_string(),
        _ => return c,
    };
    match first_name.as_str() {
        "HEAD" => {
            c.head = true;
        }
        "ORIG_HEAD" | "FETCH_HEAD" => {
            c.refs = true;
        }
        "refs" => {
            c.refs = true;
            c.head = true;
            if rest.len() >= 2 {
                if let Component::Normal(kind) = &rest[1] {
                    if kind.to_string_lossy() == "stash" {
                        c.stash = true;
                    }
                }
            }
        }
        "packed-refs" => {
            c.refs = true;
            c.head = true;
        }
        "index" => {
            c.index = true;
            c.worktree = true;
        }
        "MERGE_HEAD" | "MERGE_MSG" | "REBASE_HEAD" | "CHERRY_PICK_HEAD" | "REVERT_HEAD" => {
            c.state = true;
        }
        "rebase-merge" | "rebase-apply" => {
            c.state = true;
        }
        "BISECT_LOG" | "BISECT_START" | "BISECT_TERMS" | "BISECT_NAMES" | "BISECT_EXPECTED_REV" => {
            c.state = true;
            c.bisect = true;
        }
        "config" => {
            c.config = true;
        }
        // .git/objects, .git/logs and similar are noise — covered by ref/index updates.
        _ => {}
    }
    c
}

pub fn watch(app: AppHandle, state: &WatcherState, path: &Path) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    let key = path.to_path_buf();
    if guard.contains_key(&key) {
        return Ok(());
    }

    let root = path.to_path_buf();
    let path_string = path.to_string_lossy().to_string();
    let pending = Arc::new(Mutex::new(RepoChange {
        path: path_string.clone(),
        ..RepoChange::default()
    }));
    // A bounded wake-up channel coalesces bursts without retaining one message
    // per file. The actual flags are merged in `pending`.
    let (wake_tx, wake_rx) = mpsc::sync_channel(1);
    let callback_pending = Arc::clone(&pending);
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<Event, notify::Error>| {
            let Ok(event) = res else {
                return;
            };
            let mut batch = RepoChange::default();
            for event_path in &event.paths {
                batch.merge(&classify(event_path, &root));
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
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    let worker = std::thread::Builder::new()
        .name("etch repo watcher".to_string())
        .spawn(move || {
            const DEBOUNCE: Duration = Duration::from_millis(600);
            while wake_rx.recv().is_ok() {
                // Wait until the burst has been quiet for one debounce period.
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

    guard.insert(
        key,
        ActiveWatcher {
            watcher: Some(watcher),
            worker: Some(worker),
        },
    );
    Ok(())
}

pub fn unwatch(state: &WatcherState, path: &Path) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    guard.remove(path);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::classify;
    use std::path::Path;

    #[test]
    fn ignores_generated_worktrees_before_debouncing() {
        let root = Path::new("/repo");
        assert!(!classify(Path::new("/repo/node_modules/pkg/index.js"), root).any());
        assert!(!classify(Path::new("/repo/target/debug/app"), root).any());
        assert!(classify(Path::new("/repo/src/main.rs"), root).worktree);
    }

    #[test]
    fn classifies_git_index_changes() {
        let change = classify(Path::new("/repo/.git/index"), Path::new("/repo"));
        assert!(change.index);
        assert!(change.worktree);
    }
}
