use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::git::{
    branch::{checkout, checkout_tracking, create_branch, delete_branch, rename_branch},
    cli::run_git,
    diff::{commit_changes, file_diff, working_diff, FileChange, FileDiff},
    log::{commit_log, CommitSummary},
    refs::{list_refs, RefListing},
    remote::{fetch, pull, push, upstream_status, UpstreamStatus},
    repo::{open_repo, RepoInfo},
    stage::{apply_patch, commit, discard_paths, stage_paths, unstage_paths, CommitResult},
    status::{status, RepoStatus},
};
use crate::providers::{fetch_authors_for_remote, Author};
use crate::watcher::{watch, WatcherState};

#[tauri::command]
pub fn cmd_open_repo(
    app: AppHandle,
    watcher: State<'_, WatcherState>,
    path: String,
) -> AppResult<RepoInfo> {
    let buf = PathBuf::from(&path);
    let info = open_repo(&buf)?;
    let watch_path = PathBuf::from(&info.path);
    watch(app, &watcher, &watch_path).map_err(AppError::Other)?;
    Ok(info)
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
pub fn cmd_file_diff(path: String, commit_id: String, file_path: String) -> AppResult<FileDiff> {
    file_diff(&PathBuf::from(path), &commit_id, &file_path)
}

#[tauri::command]
pub fn cmd_status(path: String) -> AppResult<RepoStatus> {
    status(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_working_diff(path: String, file_path: String, staged: bool) -> AppResult<FileDiff> {
    working_diff(&PathBuf::from(path), &file_path, staged)
}

#[tauri::command]
pub fn cmd_stage_paths(path: String, paths: Vec<String>) -> AppResult<()> {
    stage_paths(&PathBuf::from(path), &paths)
}

#[tauri::command]
pub fn cmd_unstage_paths(path: String, paths: Vec<String>) -> AppResult<()> {
    unstage_paths(&PathBuf::from(path), &paths)
}

#[tauri::command]
pub fn cmd_discard_paths(path: String, paths: Vec<String>) -> AppResult<()> {
    discard_paths(&PathBuf::from(path), &paths)
}

#[tauri::command]
pub fn cmd_apply_patch(
    path: String,
    patch: String,
    cached: bool,
    reverse: bool,
) -> AppResult<()> {
    apply_patch(&PathBuf::from(path), &patch, cached, reverse)
}

#[tauri::command]
pub fn cmd_commit(path: String, message: String, amend: bool) -> AppResult<CommitResult> {
    commit(&PathBuf::from(path), &message, amend)
}

#[tauri::command]
pub fn cmd_create_branch(
    path: String,
    name: String,
    start_point: Option<String>,
) -> AppResult<()> {
    create_branch(&PathBuf::from(path), &name, start_point.as_deref())
}

#[tauri::command]
pub fn cmd_checkout(path: String, target: String, create: bool) -> AppResult<()> {
    checkout(&PathBuf::from(path), &target, create)
}

#[tauri::command]
pub fn cmd_checkout_tracking(path: String, local_name: String, upstream: String) -> AppResult<()> {
    checkout_tracking(&PathBuf::from(path), &local_name, &upstream)
}

#[tauri::command]
pub fn cmd_delete_branch(path: String, name: String, force: bool) -> AppResult<()> {
    delete_branch(&PathBuf::from(path), &name, force)
}

#[tauri::command]
pub fn cmd_rename_branch(
    path: String,
    old_name: String,
    new_name: String,
    force: bool,
) -> AppResult<()> {
    rename_branch(&PathBuf::from(path), &old_name, &new_name, force)
}

#[tauri::command]
pub fn cmd_upstream_status(path: String) -> AppResult<UpstreamStatus> {
    upstream_status(&PathBuf::from(path))
}

#[tauri::command]
pub async fn cmd_fetch(path: String, remote: Option<String>, prune: bool) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        fetch(&PathBuf::from(&path), remote.as_deref(), prune)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_pull(path: String, ff_only: bool) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || pull(&PathBuf::from(&path), ff_only))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_push(
    path: String,
    remote: Option<String>,
    branch: Option<String>,
    set_upstream: bool,
    force_with_lease: bool,
) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        push(
            &PathBuf::from(&path),
            remote.as_deref(),
            branch.as_deref(),
            set_upstream,
            force_with_lease,
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_remote_authors(path: String) -> AppResult<Vec<Author>> {
    tauri::async_runtime::spawn_blocking(move || {
        let out = run_git(&PathBuf::from(&path), &["config", "--get", "remote.origin.url"])?;
        let remote = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if remote.is_empty() {
            return Ok(Vec::new());
        }
        fetch_authors_for_remote(&remote)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}
