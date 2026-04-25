mod commands;
mod error;
mod git;
#[cfg(target_os = "macos")]
mod menu;
mod providers;
mod settings;
mod watcher;

use commands::repo::{
    cmd_abort_cherry_pick, cmd_abort_merge, cmd_abort_revert, cmd_add_remote, cmd_apply_patch,
    cmd_apply_stash, cmd_blame, cmd_file_history, cmd_list_remotes, cmd_remove_remote,
    cmd_rename_remote, cmd_reset, cmd_set_remote_url,
    cmd_checkout, cmd_checkout_tracking, cmd_cherry_pick, cmd_clone_repo, cmd_commit,
    cmd_abort_rebase, cmd_conflict_sides, cmd_continue_rebase, cmd_list_conflicts,
    cmd_mark_resolved, cmd_resolve_with, cmd_resolve_with_content, cmd_skip_rebase,
    cmd_preview_rebase_todo, cmd_start_interactive_rebase, cmd_start_rebase, cmd_unmark_conflict,
    cmd_abort_bisect, cmd_commit_changes, cmd_commit_log, cmd_commit_message,
    cmd_continue_cherry_pick, cmd_continue_merge, cmd_continue_revert,
    cmd_create_branch, cmd_create_stash, cmd_create_tag, cmd_delete_branch, cmd_delete_tag,
    cmd_discard_paths, cmd_drop_stash, cmd_fetch, cmd_file_diff, cmd_init_repo, cmd_list_refs,
    cmd_list_stashes, cmd_merge, cmd_open_repo, cmd_pop_stash, cmd_pull, cmd_push, cmd_push_tag,
    cmd_read_identity, cmd_remote_authors, cmd_rename_branch, cmd_repo_state, cmd_revert,
    cmd_stage_paths, cmd_status, cmd_unstage_paths, cmd_upstream_status, cmd_working_diff,
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
        .manage(WatcherState::default());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::on_event);

    builder
        .setup(|app| {
            settings::init(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            cmd_open_repo,
            cmd_clone_repo,
            cmd_init_repo,
            cmd_read_identity,
            cmd_write_identity,
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
            cmd_abort_bisect,
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

