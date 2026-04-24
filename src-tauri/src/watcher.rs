use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use notify_debouncer_full::notify::{RecursiveMode, Watcher};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
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

pub fn watch(app: AppHandle, state: &WatcherState, path: &Path) -> Result<(), String> {
    let mut guard = state.inner.lock().map_err(|e| e.to_string())?;
    if let Some(existing) = guard.as_ref() {
        if existing.path == path {
            return Ok(());
        }
    }
    *guard = None;

    let app_clone = app.clone();
    let mut debouncer = new_debouncer(
        Duration::from_millis(400),
        None,
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                if events.is_empty() {
                    return;
                }
                let _ = app_clone.emit("repo-changed", ());
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

