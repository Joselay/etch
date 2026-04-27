mod cancel;
mod commands;
mod error;
mod git;
#[cfg(target_os = "macos")]
mod menu;
mod providers;
mod settings;
mod watcher;

use cancel::CancelRegistry;
use commands::repo::{
    cmd_abort_bisect, cmd_abort_cherry_pick, cmd_abort_merge, cmd_abort_rebase, cmd_abort_revert,
    cmd_add_remote, cmd_add_worktree, cmd_append_gitignore, cmd_apply_patch, cmd_apply_stash,
    cmd_bisect_log, cmd_bisect_mark, cmd_bisect_start, cmd_blame, cmd_cancel_operation,
    cmd_checkout, cmd_checkout_tracking, cmd_cherry_pick, cmd_ci_status, cmd_clean_untracked_paths,
    cmd_clone_repo, cmd_close_repo, cmd_commit, cmd_commit_changes, cmd_commit_log,
    cmd_commit_message, cmd_conflict_sides, cmd_continue_cherry_pick, cmd_continue_merge,
    cmd_continue_rebase, cmd_continue_revert, cmd_create_branch, cmd_create_stash, cmd_create_tag,
    cmd_delete_branch, cmd_delete_tag, cmd_discard_paths, cmd_drop_stash, cmd_fetch, cmd_file_diff,
    cmd_file_history, cmd_init_repo, cmd_init_submodule, cmd_list_conflicts, cmd_list_git_config,
    cmd_list_prs, cmd_list_refs, cmd_list_remotes, cmd_list_stashes, cmd_list_submodules,
    cmd_list_worktrees, cmd_mark_resolved, cmd_merge, cmd_new_cancel_token, cmd_open_repo,
    cmd_pop_stash, cmd_preview_rebase_todo, cmd_prune_worktrees, cmd_pull, cmd_push, cmd_push_tag,
    cmd_range_diff, cmd_read_commit_template, cmd_read_crlf_config, cmd_read_git_config,
    cmd_read_gitignore, cmd_read_identity, cmd_read_signing_config, cmd_reflog, cmd_remote_authors,
    cmd_remove_remote, cmd_remove_worktree, cmd_rename_branch, cmd_rename_remote, cmd_repo_state,
    cmd_reset, cmd_resolve_with, cmd_resolve_with_content, cmd_revert, cmd_set_remote_url,
    cmd_set_upstream, cmd_skip_rebase, cmd_stage_paths, cmd_start_interactive_rebase,
    cmd_start_rebase, cmd_status, cmd_sync_submodules, cmd_unmark_conflict, cmd_unset_git_config,
    cmd_unset_upstream, cmd_unstage_paths, cmd_untrack_file, cmd_update_submodule,
    cmd_upstream_status, cmd_working_diff, cmd_write_git_config, cmd_write_gitignore,
    cmd_write_identity,
};
use commands::settings::{
    cmd_clear_provider_token, cmd_list_provider_tokens, cmd_set_provider_token,
};
use watcher::WatcherState;

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(WatcherState::default())
        .manage(CancelRegistry::default());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::on_event);

    builder
        .setup(|app| {
            settings::init(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_open_repo,
            cmd_close_repo,
            cmd_clone_repo,
            cmd_init_repo,
            cmd_read_identity,
            cmd_write_identity,
            cmd_read_gitignore,
            cmd_write_gitignore,
            cmd_append_gitignore,
            cmd_untrack_file,
            cmd_read_signing_config,
            cmd_read_commit_template,
            cmd_read_git_config,
            cmd_write_git_config,
            cmd_unset_git_config,
            cmd_list_git_config,
            cmd_read_crlf_config,
            cmd_list_stashes,
            cmd_create_stash,
            cmd_apply_stash,
            cmd_pop_stash,
            cmd_drop_stash,
            cmd_merge,
            cmd_revert,
            cmd_cherry_pick,
            cmd_abort_merge,
            cmd_abort_revert,
            cmd_abort_cherry_pick,
            cmd_continue_revert,
            cmd_continue_cherry_pick,
            cmd_continue_merge,
            cmd_repo_state,
            cmd_list_remotes,
            cmd_add_remote,
            cmd_remove_remote,
            cmd_rename_remote,
            cmd_set_remote_url,
            cmd_reset,
            cmd_create_tag,
            cmd_delete_tag,
            cmd_push_tag,
            cmd_commit_log,
            cmd_commit_message,
            cmd_reflog,
            cmd_abort_bisect,
            cmd_bisect_start,
            cmd_bisect_mark,
            cmd_bisect_log,
            cmd_list_submodules,
            cmd_init_submodule,
            cmd_update_submodule,
            cmd_sync_submodules,
            cmd_set_upstream,
            cmd_unset_upstream,
            cmd_range_diff,
            cmd_list_worktrees,
            cmd_add_worktree,
            cmd_remove_worktree,
            cmd_prune_worktrees,
            cmd_cancel_operation,
            cmd_new_cancel_token,
            cmd_file_history,
            cmd_blame,
            cmd_list_refs,
            cmd_commit_changes,
            cmd_file_diff,
            cmd_status,
            cmd_working_diff,
            cmd_stage_paths,
            cmd_unstage_paths,
            cmd_discard_paths,
            cmd_clean_untracked_paths,
            cmd_apply_patch,
            cmd_commit,
            cmd_create_branch,
            cmd_checkout,
            cmd_checkout_tracking,
            cmd_delete_branch,
            cmd_rename_branch,
            cmd_upstream_status,
            cmd_fetch,
            cmd_pull,
            cmd_push,
            cmd_remote_authors,
            cmd_list_prs,
            cmd_ci_status,
            cmd_list_conflicts,
            cmd_conflict_sides,
            cmd_resolve_with,
            cmd_resolve_with_content,
            cmd_mark_resolved,
            cmd_unmark_conflict,
            cmd_start_rebase,
            cmd_continue_rebase,
            cmd_abort_rebase,
            cmd_skip_rebase,
            cmd_preview_rebase_todo,
            cmd_start_interactive_rebase,
            cmd_list_provider_tokens,
            cmd_set_provider_token,
            cmd_clear_provider_token
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
