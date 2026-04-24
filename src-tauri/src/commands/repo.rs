use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::error::{AppError, AppResult};
use crate::git::{
    blame::{blame, BlameLine},
    branch::{
        abort_cherry_pick, abort_merge, abort_revert, checkout, checkout_tracking,
        cherry_pick, create_branch, delete_branch, merge, rename_branch, reset, revert,
        ResetMode,
    },
    cli::run_git,
    conflict::{
        list_conflicts, mark_resolved, read_conflict_sides, resolve_with, resolve_with_content,
        unmark, ConflictEntry, ConflictSides, ResolveSide,
    },
    diff::{commit_changes, file_diff, working_diff, FileChange, FileDiff},
    identity::{read_identity, write_identity, Identity},
    log::{commit_log, commit_log_for_file, CommitSummary},
    rebase::{
        abort_rebase, continue_rebase, preview_todo, skip_rebase, start_interactive_rebase,
        start_rebase, TodoEntry,
    },
    refs::{list_refs, RefListing},
    remote::{
        add_remote, fetch, list_remotes, pull, push, remove_remote, rename_remote,
        set_remote_url, upstream_status, RemoteInfo, UpstreamStatus,
    },
    repo::{clone_repo, init_repo, open_repo, RepoInfo},
    stage::{apply_patch, commit, discard_paths, stage_paths, unstage_paths, CommitResult},
    stash::{apply_stash, create_stash, drop_stash, list_stashes, pop_stash, StashEntry},
    state::{continue_cherry_pick, continue_merge, continue_revert, repo_state, RepoState},
    status::{status, RepoStatus},
    tags::{create_tag, delete_tag, push_tag},
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
    query: Option<String>,
    all_branches: Option<bool>,
) -> AppResult<Vec<CommitSummary>> {
    commit_log(
        &PathBuf::from(path),
        limit.unwrap_or(200),
        skip.unwrap_or(0),
        query.as_deref(),
        all_branches.unwrap_or(false),
    )
}

#[tauri::command]
pub fn cmd_list_refs(path: String) -> AppResult<RefListing> {
    list_refs(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_file_history(
    path: String,
    file: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> AppResult<Vec<CommitSummary>> {
    commit_log_for_file(
        &PathBuf::from(path),
        &file,
        limit.unwrap_or(500),
        skip.unwrap_or(0),
    )
}

#[tauri::command]
pub fn cmd_blame(path: String, file: String, rev: Option<String>) -> AppResult<Vec<BlameLine>> {
    blame(&PathBuf::from(path), &file, rev.as_deref())
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
pub async fn cmd_clone_repo(
    app: AppHandle,
    watcher: State<'_, WatcherState>,
    url: String,
    dest: String,
) -> AppResult<RepoInfo> {
    let dest_buf = PathBuf::from(&dest);
    tauri::async_runtime::spawn_blocking(move || clone_repo(&url, &PathBuf::from(&dest)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))??;
    let info = open_repo(&dest_buf)?;
    let watch_path = PathBuf::from(&info.path);
    watch(app, &watcher, &watch_path).map_err(AppError::Other)?;
    Ok(info)
}

#[tauri::command]
pub fn cmd_init_repo(
    app: AppHandle,
    watcher: State<'_, WatcherState>,
    path: String,
) -> AppResult<RepoInfo> {
    let buf = PathBuf::from(&path);
    init_repo(&buf)?;
    let info = open_repo(&buf)?;
    let watch_path = PathBuf::from(&info.path);
    watch(app, &watcher, &watch_path).map_err(AppError::Other)?;
    Ok(info)
}

#[tauri::command]
pub fn cmd_read_identity(path: Option<String>) -> AppResult<Identity> {
    let repo = path.as_deref().map(PathBuf::from);
    read_identity(repo.as_deref())
}

#[tauri::command]
pub fn cmd_write_identity(
    path: Option<String>,
    name: Option<String>,
    email: Option<String>,
) -> AppResult<()> {
    let repo = path.as_deref().map(PathBuf::from);
    write_identity(repo.as_deref(), name.as_deref(), email.as_deref())
}

#[tauri::command]
pub fn cmd_list_stashes(path: String) -> AppResult<Vec<StashEntry>> {
    list_stashes(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_create_stash(
    path: String,
    message: Option<String>,
    include_untracked: bool,
    keep_index: bool,
) -> AppResult<()> {
    create_stash(
        &PathBuf::from(path),
        message.as_deref(),
        include_untracked,
        keep_index,
    )
}

#[tauri::command]
pub fn cmd_apply_stash(path: String, ref_name: String) -> AppResult<()> {
    apply_stash(&PathBuf::from(path), &ref_name)
}

#[tauri::command]
pub fn cmd_pop_stash(path: String, ref_name: String) -> AppResult<()> {
    pop_stash(&PathBuf::from(path), &ref_name)
}

#[tauri::command]
pub fn cmd_drop_stash(path: String, ref_name: String) -> AppResult<()> {
    drop_stash(&PathBuf::from(path), &ref_name)
}

#[tauri::command]
pub fn cmd_merge(path: String, target: String, no_ff: bool) -> AppResult<()> {
    merge(&PathBuf::from(path), &target, no_ff)
}

#[tauri::command]
pub fn cmd_revert(path: String, commit: String, no_edit: bool) -> AppResult<()> {
    revert(&PathBuf::from(path), &commit, no_edit)
}

#[tauri::command]
pub fn cmd_cherry_pick(path: String, commit: String) -> AppResult<()> {
    cherry_pick(&PathBuf::from(path), &commit)
}

#[tauri::command]
pub fn cmd_abort_merge(path: String) -> AppResult<()> {
    abort_merge(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_abort_revert(path: String) -> AppResult<()> {
    abort_revert(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_abort_cherry_pick(path: String) -> AppResult<()> {
    abort_cherry_pick(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_create_tag(
    path: String,
    name: String,
    message: Option<String>,
    target: Option<String>,
    force: bool,
) -> AppResult<()> {
    create_tag(
        &PathBuf::from(path),
        &name,
        message.as_deref(),
        target.as_deref(),
        force,
    )
}

#[tauri::command]
pub fn cmd_delete_tag(path: String, name: String) -> AppResult<()> {
    delete_tag(&PathBuf::from(path), &name)
}

#[tauri::command]
pub fn cmd_repo_state(path: String) -> AppResult<RepoState> {
    repo_state(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_continue_revert(path: String) -> AppResult<()> {
    continue_revert(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_continue_cherry_pick(path: String) -> AppResult<()> {
    continue_cherry_pick(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_continue_merge(path: String) -> AppResult<()> {
    continue_merge(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_list_remotes(path: String) -> AppResult<Vec<RemoteInfo>> {
    list_remotes(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_add_remote(path: String, name: String, url: String) -> AppResult<()> {
    add_remote(&PathBuf::from(path), &name, &url)
}

#[tauri::command]
pub fn cmd_remove_remote(path: String, name: String) -> AppResult<()> {
    remove_remote(&PathBuf::from(path), &name)
}

#[tauri::command]
pub fn cmd_rename_remote(path: String, old_name: String, new_name: String) -> AppResult<()> {
    rename_remote(&PathBuf::from(path), &old_name, &new_name)
}

#[tauri::command]
pub fn cmd_set_remote_url(
    path: String,
    name: String,
    url: String,
    push: bool,
) -> AppResult<()> {
    set_remote_url(&PathBuf::from(path), &name, &url, push)
}

#[tauri::command]
pub fn cmd_reset(path: String, target: String, mode: String) -> AppResult<()> {
    let m = match mode.as_str() {
        "soft" => ResetMode::Soft,
        "mixed" => ResetMode::Mixed,
        "hard" => ResetMode::Hard,
        other => return Err(AppError::Other(format!("invalid reset mode: {other}"))),
    };
    reset(&PathBuf::from(path), &target, m)
}

#[tauri::command]
pub async fn cmd_push_tag(
    path: String,
    remote: String,
    name: String,
    delete: bool,
) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || {
        push_tag(&PathBuf::from(&path), &remote, &name, delete)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub fn cmd_start_rebase(path: String, onto: String, upstream: Option<String>) -> AppResult<()> {
    start_rebase(&PathBuf::from(path), &onto, upstream.as_deref())
}

#[tauri::command]
pub fn cmd_continue_rebase(path: String) -> AppResult<()> {
    continue_rebase(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_abort_rebase(path: String) -> AppResult<()> {
    abort_rebase(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_skip_rebase(path: String) -> AppResult<()> {
    skip_rebase(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_preview_rebase_todo(
    path: String,
    from: String,
    onto: String,
) -> AppResult<Vec<TodoEntry>> {
    preview_todo(&PathBuf::from(path), &from, &onto)
}

#[tauri::command]
pub fn cmd_start_interactive_rebase(
    path: String,
    onto: String,
    upstream: String,
    todo: Vec<TodoEntry>,
) -> AppResult<()> {
    start_interactive_rebase(&PathBuf::from(path), &onto, &upstream, &todo)
}

#[tauri::command]
pub fn cmd_list_conflicts(path: String) -> AppResult<Vec<ConflictEntry>> {
    list_conflicts(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_conflict_sides(path: String, file: String) -> AppResult<ConflictSides> {
    read_conflict_sides(&PathBuf::from(path), &file)
}

#[tauri::command]
pub fn cmd_resolve_with(path: String, file: String, side: ResolveSide) -> AppResult<()> {
    resolve_with(&PathBuf::from(path), &file, side)
}

#[tauri::command]
pub fn cmd_resolve_with_content(path: String, file: String, content: String) -> AppResult<()> {
    resolve_with_content(&PathBuf::from(path), &file, &content)
}

#[tauri::command]
pub fn cmd_mark_resolved(path: String, files: Vec<String>) -> AppResult<()> {
    mark_resolved(&PathBuf::from(path), &files)
}

#[tauri::command]
pub fn cmd_unmark_conflict(path: String, files: Vec<String>) -> AppResult<()> {
    unmark(&PathBuf::from(path), &files)
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
