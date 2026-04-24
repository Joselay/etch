use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::{RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

pub type AppDebouncer =
    Debouncer<notify_debouncer_full::notify::RecommendedWatcher, FileIdMap>;

#[derive(Default)]
pub struct WatcherState {
    pub inner: Mutex<Option<ActiveWatcher>>,
}

pub struct ActiveWatcher {
    pub path: PathBuf,
    _debouncer: AppDebouncer,
}

#[derive(Default, Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
struct RepoChange {
    head: bool,
    refs: bool,
    index: bool,
    worktree: bool,
    state: bool,
    stash: bool,
    config: bool,
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
    }
    fn merge(&mut self, o: RepoChange) {
        self.head |= o.head;
        self.refs |= o.refs;
        self.index |= o.index;
        self.worktree |= o.worktree;
        self.state |= o.state;
        self.stash |= o.stash;
        self.config |= o.config;
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
        // Skip common large/noisy dirs we never care about for git state.
        let s = rel.to_string_lossy();
        if s.starts_with("node_modules/")
            || s.starts_with("target/")
            || s.starts_with("dist/")
            || s.starts_with("build/")
            || s.starts_with(".next/")
            || s.starts_with(".turbo/")
        {
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
    if let Some(existing) = guard.as_ref() {
        if existing.path == path {
            return Ok(());
        }
    }
    *guard = None;

    let app_clone = app.clone();
    let root = path.to_path_buf();
    let mut debouncer = new_debouncer(
        Duration::from_millis(600),
        None,
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                if events.is_empty() {
                    return;
                }
                let mut change = RepoChange::default();
                for ev in &events {
                    for p in &ev.paths {
                        change.merge(classify(p, &root));
                    }
                }
                if change.any() {
                    let _ = app_clone.emit("repo-changed", change);
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *guard = Some(ActiveWatcher {
        path: path.to_path_buf(),
        _debouncer: debouncer,
    });
    Ok(())
}
