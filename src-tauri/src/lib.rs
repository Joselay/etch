mod commands;
mod error;
mod git;
#[cfg(target_os = "macos")]
mod menu;
mod watcher;

use commands::repo::{
    cmd_close_repo, cmd_commit_changes, cmd_commit_log, cmd_commit_message, cmd_file_diff,
    cmd_open_repo, cmd_status, cmd_working_diff,
};
use watcher::WatcherState;

pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .manage(WatcherState::default());

    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::on_event);

    builder
        .invoke_handler(tauri::generate_handler![
            cmd_open_repo,
            cmd_close_repo,
            cmd_commit_log,
            cmd_commit_message,
            cmd_commit_changes,
            cmd_file_diff,
            cmd_status,
            cmd_working_diff,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
