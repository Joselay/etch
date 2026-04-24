use std::path::PathBuf;

use crate::error::AppResult;
use crate::git::{
    diff::{commit_changes, file_diff, FileChange, FileDiff},
    log::{commit_log, CommitSummary},
    refs::{list_refs, RefListing},
    repo::{open_repo, RepoInfo},
};

#[tauri::command]
pub fn cmd_open_repo(path: String) -> AppResult<RepoInfo> {
    open_repo(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_commit_log(
    path: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> AppResult<Vec<CommitSummary>> {
    commit_log(&PathBuf::from(path), limit.unwrap_or(200), skip.unwrap_or(0))
}

#[tauri::command]
pub fn cmd_list_refs(path: String) -> AppResult<RefListing> {
    list_refs(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_commit_changes(path: String, commit_id: String) -> AppResult<Vec<FileChange>> {
    commit_changes(&PathBuf::from(path), &commit_id)
}

#[tauri::command]
pub fn cmd_file_diff(
    path: String,
    commit_id: String,
    file_path: String,
) -> AppResult<FileDiff> {
    file_diff(&PathBuf::from(path), &commit_id, &file_path)
}
