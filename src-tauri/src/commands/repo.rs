use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::git::{
    diff::{commit_changes, file_diff, working_diff, FileChange, FileDiff},
    log::{commit_log, commit_message, CommitSummary},
    repo::{open_repo, RepoInfo},
    status::{status, RepoStatus},
};
use crate::watcher::{unwatch, watch, WatcherState};

#[tauri::command]
pub fn cmd_open_repo(
    app: AppHandle,
    watcher: State<'_, WatcherState>,
    path: String,
) -> AppResult<RepoInfo> {
    let info = open_repo(&PathBuf::from(path))?;
    watch(app, &watcher, &PathBuf::from(&info.path)).map_err(AppError::Other)?;
    Ok(info)
}

#[tauri::command]
pub fn cmd_close_repo(watcher: State<'_, WatcherState>, path: String) -> AppResult<()> {
    unwatch(&watcher, &PathBuf::from(path)).map_err(AppError::Other)
}

#[tauri::command]
pub async fn cmd_commit_log(
    path: String,
    limit: Option<usize>,
    skip: Option<usize>,
    query: Option<String>,
    all_branches: Option<bool>,
) -> AppResult<Vec<CommitSummary>> {
    tauri::async_runtime::spawn_blocking(move || {
        commit_log(
            &PathBuf::from(path),
            limit.unwrap_or(200),
            skip.unwrap_or(0),
            query.as_deref(),
            all_branches.unwrap_or(false),
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_commit_message(path: String, commit_id: String) -> AppResult<String> {
    tauri::async_runtime::spawn_blocking(move || commit_message(&PathBuf::from(path), &commit_id))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_commit_changes(path: String, commit_id: String) -> AppResult<Vec<FileChange>> {
    tauri::async_runtime::spawn_blocking(move || commit_changes(&PathBuf::from(path), &commit_id))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_file_diff(
    path: String,
    commit_id: String,
    file_path: String,
) -> AppResult<FileDiff> {
    tauri::async_runtime::spawn_blocking(move || {
        file_diff(&PathBuf::from(path), &commit_id, &file_path)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_status(path: String) -> AppResult<RepoStatus> {
    tauri::async_runtime::spawn_blocking(move || status(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_working_diff(
    path: String,
    file_path: String,
    staged: bool,
) -> AppResult<FileDiff> {
    tauri::async_runtime::spawn_blocking(move || {
        working_diff(&PathBuf::from(path), &file_path, staged)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}
