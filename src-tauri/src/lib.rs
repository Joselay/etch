mod commands;
mod error;
mod git;
mod watcher;

use commands::repo::{
    cmd_checkout, cmd_checkout_tracking, cmd_commit, cmd_commit_changes, cmd_commit_log,
    cmd_create_branch, cmd_delete_branch, cmd_discard_paths, cmd_file_diff, cmd_list_refs,
    cmd_open_repo, cmd_rename_branch, cmd_stage_paths, cmd_status, cmd_unstage_paths,
    cmd_working_diff,
};
use watcher::WatcherState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(WatcherState::default())
        .invoke_handler(tauri::generate_handler![
            cmd_open_repo,
            cmd_commit_log,
            cmd_list_refs,
            cmd_commit_changes,
            cmd_file_diff,
            cmd_status,
            cmd_working_diff,
            cmd_stage_paths,
            cmd_unstage_paths,
            cmd_discard_paths,
            cmd_commit,
            cmd_create_branch,
            cmd_checkout,
            cmd_checkout_tracking,
            cmd_delete_branch,
            cmd_rename_branch
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
