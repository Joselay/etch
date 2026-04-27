use std::path::PathBuf;

use tauri::{AppHandle, State};

use crate::cancel::CancelRegistry;
use crate::error::{AppError, AppResult};
use crate::git::{
    bisect::{bisect_log, bisect_mark, bisect_start, BisectLogEntry, BisectStatus, BisectVerdict},
    blame::{blame, BlameLine},
    branch::{
        abort_cherry_pick, abort_merge, abort_revert, checkout, checkout_tracking, cherry_pick,
        create_branch, delete_branch, merge, rename_branch, reset, revert, ResetMode,
    },
    cli::run_git,
    config::{
        list_config, read_config, read_crlf_config, unset_config, write_config, ConfigEntry,
        CrlfConfig,
    },
    conflict::{
        list_conflicts, mark_resolved, read_conflict_sides, resolve_with, resolve_with_content,
        unmark, ConflictEntry, ConflictSides, ResolveSide,
    },
    diff::{commit_changes, file_diff, working_diff, FileChange, FileDiff},
    identity::{read_identity, write_identity, Identity},
    ignore::{append_gitignore, read_gitignore, untrack_file, write_gitignore},
    log::{commit_log, commit_log_for_file, commit_message, range_diff, CommitSummary},
    rebase::{
        abort_rebase, continue_rebase, preview_todo, skip_rebase, start_interactive_rebase,
        start_rebase, TodoEntry,
    },
    reflog::{list_reflog, ReflogEntry},
    refs::{list_refs, RefListing},
    remote::{
        add_remote, fetch_cancellable, list_remotes, origin_remote_url, pull, push, remove_remote,
        rename_remote, set_remote_url, set_upstream, unset_upstream, upstream_status, RemoteInfo,
        UpstreamStatus,
    },
    repo::{clone_repo_cancellable, init_repo, open_repo, RepoInfo},
    sign::{read_commit_template, read_signing_config, SigningConfig},
    stage::{apply_patch, commit, discard_paths, stage_paths, unstage_paths, CommitResult},
    stash::{apply_stash, create_stash, drop_stash, list_stashes, pop_stash, StashEntry},
    state::{continue_cherry_pick, continue_merge, continue_revert, repo_state, RepoState},
    status::{status, RepoStatus},
    submodule::{
        init_submodule, list_submodules, sync_submodules, update_submodule, SubmoduleInfo,
    },
    tags::{create_tag, delete_tag, push_tag},
    worktree::{add_worktree, list_worktrees, prune_worktrees, remove_worktree, WorktreeInfo},
};
use crate::providers::github::{
    combined_status_for_ref, list_prs_for_branch, CombinedStatus, PullRequest,
};
use crate::providers::{fetch_authors_for_remote, Author};
use crate::watcher::{unwatch, watch, WatcherState};

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
pub fn cmd_close_repo(watcher: State<'_, WatcherState>, path: String) -> AppResult<()> {
    let buf = PathBuf::from(&path);
    unwatch(&watcher, &buf).map_err(AppError::Other)?;
    Ok(())
}

#[tauri::command]
pub async fn cmd_commit_log(
    path: String,
    limit: Option<usize>,
    skip: Option<usize>,
    query: Option<String>,
    all_branches: Option<bool>,
    path_filter: Option<String>,
    pickaxe: Option<String>,
) -> AppResult<Vec<CommitSummary>> {
    tauri::async_runtime::spawn_blocking(move || {
        commit_log(
            &PathBuf::from(path),
            limit.unwrap_or(200),
            skip.unwrap_or(0),
            query.as_deref(),
            all_branches.unwrap_or(false),
            path_filter.as_deref(),
            pickaxe.as_deref(),
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_list_refs(path: String) -> AppResult<RefListing> {
    tauri::async_runtime::spawn_blocking(move || list_refs(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_file_history(
    path: String,
    file: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> AppResult<Vec<CommitSummary>> {
    tauri::async_runtime::spawn_blocking(move || {
        commit_log_for_file(
            &PathBuf::from(path),
            &file,
            limit.unwrap_or(500),
            skip.unwrap_or(0),
        )
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_reflog(
    path: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> AppResult<Vec<ReflogEntry>> {
    tauri::async_runtime::spawn_blocking(move || list_reflog(&PathBuf::from(path), limit, skip))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_blame(
    path: String,
    file: String,
    rev: Option<String>,
) -> AppResult<Vec<BlameLine>> {
    tauri::async_runtime::spawn_blocking(move || blame(&PathBuf::from(path), &file, rev.as_deref()))
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
pub fn cmd_apply_patch(path: String, patch: String, cached: bool, reverse: bool) -> AppResult<()> {
    apply_patch(&PathBuf::from(path), &patch, cached, reverse)
}

#[tauri::command]
pub fn cmd_commit(
    path: String,
    message: String,
    amend: bool,
    sign_off: Option<bool>,
    sign: Option<bool>,
) -> AppResult<CommitResult> {
    commit(
        &PathBuf::from(path),
        &message,
        amend,
        sign_off.unwrap_or(false),
        sign,
    )
}

#[tauri::command]
pub fn cmd_read_git_config(
    path: Option<String>,
    key: String,
    global: bool,
) -> AppResult<Option<String>> {
    let repo = path.as_deref().map(PathBuf::from);
    read_config(repo.as_deref(), &key, global)
}

#[tauri::command]
pub fn cmd_write_git_config(
    path: Option<String>,
    key: String,
    value: String,
    global: bool,
) -> AppResult<()> {
    let repo = path.as_deref().map(PathBuf::from);
    write_config(repo.as_deref(), &key, &value, global)
}

#[tauri::command]
pub fn cmd_unset_git_config(path: Option<String>, key: String, global: bool) -> AppResult<()> {
    let repo = path.as_deref().map(PathBuf::from);
    unset_config(repo.as_deref(), &key, global)
}

#[tauri::command]
pub fn cmd_list_git_config(path: Option<String>, global: bool) -> AppResult<Vec<ConfigEntry>> {
    let repo = path.as_deref().map(PathBuf::from);
    list_config(repo.as_deref(), global)
}

#[tauri::command]
pub fn cmd_read_crlf_config(path: String) -> AppResult<CrlfConfig> {
    read_crlf_config(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_read_signing_config(path: String) -> AppResult<SigningConfig> {
    read_signing_config(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_read_commit_template(path: String) -> AppResult<Option<String>> {
    read_commit_template(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_create_branch(path: String, name: String, start_point: Option<String>) -> AppResult<()> {
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
pub async fn cmd_upstream_status(path: String) -> AppResult<UpstreamStatus> {
    tauri::async_runtime::spawn_blocking(move || upstream_status(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_fetch(
    cancel: State<'_, CancelRegistry>,
    path: String,
    remote: Option<String>,
    prune: bool,
    token_id: Option<u64>,
) -> AppResult<()> {
    let flag = token_id.and_then(|id| cancel.flag_for(id));
    let result = tauri::async_runtime::spawn_blocking(move || {
        fetch_cancellable(&PathBuf::from(&path), remote.as_deref(), prune, flag)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?;
    if let Some(id) = token_id {
        cancel.remove(id);
    }
    result
}

#[tauri::command]
pub fn cmd_cancel_operation(cancel: State<'_, CancelRegistry>, token_id: u64) -> AppResult<()> {
    cancel.cancel(token_id);
    Ok(())
}

#[tauri::command]
pub fn cmd_new_cancel_token(cancel: State<'_, CancelRegistry>) -> u64 {
    let (id, _) = cancel.new_token();
    id
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
    cancel: State<'_, CancelRegistry>,
    url: String,
    dest: String,
    token_id: Option<u64>,
) -> AppResult<RepoInfo> {
    let dest_buf = PathBuf::from(&dest);
    let flag = token_id.and_then(|id| cancel.flag_for(id));
    let clone_result = tauri::async_runtime::spawn_blocking(move || {
        clone_repo_cancellable(&url, &PathBuf::from(&dest), flag)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?;
    if let Some(id) = token_id {
        cancel.remove(id);
    }
    clone_result?;
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
pub fn cmd_read_gitignore(path: String) -> AppResult<String> {
    read_gitignore(&PathBuf::from(path))
}

#[tauri::command]
pub fn cmd_write_gitignore(path: String, content: String) -> AppResult<()> {
    write_gitignore(&PathBuf::from(path), &content)
}

#[tauri::command]
pub fn cmd_append_gitignore(path: String, pattern: String) -> AppResult<()> {
    append_gitignore(&PathBuf::from(path), &pattern)
}

#[tauri::command]
pub fn cmd_untrack_file(path: String, file: String) -> AppResult<()> {
    untrack_file(&PathBuf::from(path), &file)
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
pub async fn cmd_list_stashes(path: String) -> AppResult<Vec<StashEntry>> {
    tauri::async_runtime::spawn_blocking(move || list_stashes(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub fn cmd_create_stash(
    path: String,
    message: Option<String>,
    include_untracked: bool,
    keep_index: bool,
    paths: Option<Vec<String>>,
) -> AppResult<()> {
    let selected = paths.unwrap_or_default();
    create_stash(
        &PathBuf::from(path),
        message.as_deref(),
        include_untracked,
        keep_index,
        &selected,
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
pub fn cmd_merge(path: String, target: String, no_ff: bool, squash: Option<bool>) -> AppResult<()> {
    merge(
        &PathBuf::from(path),
        &target,
        no_ff,
        squash.unwrap_or(false),
    )
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
pub fn cmd_abort_bisect(path: String) -> AppResult<()> {
    run_git(&PathBuf::from(path), &["bisect", "reset"])?;
    Ok(())
}

#[tauri::command]
pub fn cmd_set_upstream(
    path: String,
    branch: String,
    remote: String,
    remote_branch: String,
) -> AppResult<()> {
    set_upstream(&PathBuf::from(path), &branch, &remote, &remote_branch)
}

#[tauri::command]
pub fn cmd_unset_upstream(path: String, branch: String) -> AppResult<()> {
    unset_upstream(&PathBuf::from(path), &branch)
}

#[tauri::command]
pub async fn cmd_range_diff(
    path: String,
    base: String,
    head: String,
    limit: Option<usize>,
) -> AppResult<Vec<CommitSummary>> {
    tauri::async_runtime::spawn_blocking(move || {
        range_diff(&PathBuf::from(path), &base, &head, limit.unwrap_or(500))
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_list_worktrees(path: String) -> AppResult<Vec<WorktreeInfo>> {
    tauri::async_runtime::spawn_blocking(move || list_worktrees(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub fn cmd_add_worktree(
    path: String,
    target: String,
    branch: Option<String>,
    create: bool,
) -> AppResult<()> {
    add_worktree(&PathBuf::from(path), &target, branch.as_deref(), create)
}

#[tauri::command]
pub fn cmd_remove_worktree(path: String, target: String, force: bool) -> AppResult<()> {
    remove_worktree(&PathBuf::from(path), &target, force)
}

#[tauri::command]
pub fn cmd_prune_worktrees(path: String) -> AppResult<()> {
    prune_worktrees(&PathBuf::from(path))
}

#[tauri::command]
pub async fn cmd_list_submodules(path: String) -> AppResult<Vec<SubmoduleInfo>> {
    tauri::async_runtime::spawn_blocking(move || list_submodules(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_init_submodule(path: String, sub: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || init_submodule(&PathBuf::from(path), &sub))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_update_submodule(path: String, sub: String, init: bool) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || update_submodule(&PathBuf::from(path), &sub, init))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_sync_submodules(path: String) -> AppResult<()> {
    tauri::async_runtime::spawn_blocking(move || sync_submodules(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub fn cmd_bisect_start(path: String, bad: String, good: String) -> AppResult<BisectStatus> {
    bisect_start(&PathBuf::from(path), &bad, &good)
}

#[tauri::command]
pub fn cmd_bisect_mark(path: String, verdict: BisectVerdict) -> AppResult<BisectStatus> {
    bisect_mark(&PathBuf::from(path), verdict)
}

#[tauri::command]
pub fn cmd_bisect_log(path: String) -> AppResult<Vec<BisectLogEntry>> {
    bisect_log(&PathBuf::from(path))
}

#[tauri::command]
pub async fn cmd_repo_state(path: String) -> AppResult<RepoState> {
    tauri::async_runtime::spawn_blocking(move || repo_state(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
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
pub fn cmd_set_remote_url(path: String, name: String, url: String, push: bool) -> AppResult<()> {
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
pub async fn cmd_list_conflicts(path: String) -> AppResult<Vec<ConflictEntry>> {
    tauri::async_runtime::spawn_blocking(move || list_conflicts(&PathBuf::from(path)))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_conflict_sides(path: String, file: String) -> AppResult<ConflictSides> {
    tauri::async_runtime::spawn_blocking(move || read_conflict_sides(&PathBuf::from(path), &file))
        .await
        .map_err(|e| AppError::Other(format!("join: {e}")))?
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
pub async fn cmd_list_prs(path: String, branch: String) -> AppResult<Vec<PullRequest>> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(remote) = origin_remote_url(&PathBuf::from(&path))? else {
            return Ok(Vec::new());
        };
        list_prs_for_branch(&remote, &branch)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_ci_status(path: String, ref_: String) -> AppResult<Option<CombinedStatus>> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(remote) = origin_remote_url(&PathBuf::from(&path))? else {
            return Ok(None);
        };
        combined_status_for_ref(&remote, &ref_)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}

#[tauri::command]
pub async fn cmd_remote_authors(path: String) -> AppResult<Vec<Author>> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(remote) = origin_remote_url(&PathBuf::from(&path))? else {
            return Ok(Vec::new());
        };
        fetch_authors_for_remote(&remote)
    })
    .await
    .map_err(|e| AppError::Other(format!("join: {e}")))?
}
