use tauri::{
    menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
};

pub fn build<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(handle, "Etch")
        .about(None)
        .separator()
        .item(
            &MenuItemBuilder::with_id("settings", "Preferences…")
                .accelerator("CmdOrCtrl+,")
                .build(handle)?,
        )
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(handle, "File")
        .item(
            &MenuItemBuilder::with_id("new-repo", "New Repository…")
                .accelerator("CmdOrCtrl+N")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("open-repo", "Open Repository…")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("clone-repo", "Clone Repository…")
                .accelerator("CmdOrCtrl+Shift+O")
                .build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("close-repo", "Close Repository")
                .accelerator("CmdOrCtrl+W")
                .build(handle)?,
        )
        .build()?;

    let edit_menu = SubmenuBuilder::new(handle, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(handle, "View")
        .item(
            &MenuItemBuilder::with_id("view-history", "History")
                .accelerator("CmdOrCtrl+1")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("view-changes", "Changes")
                .accelerator("CmdOrCtrl+2")
                .build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("command-palette", "Command Palette…")
                .accelerator("CmdOrCtrl+K")
                .build(handle)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-word-wrap", "Toggle Diff Word Wrap").build(handle)?)
        .item(
            &MenuItemBuilder::with_id("toggle-line-numbers", "Toggle Diff Line Numbers")
                .build(handle)?,
        )
        .build()?;

    let repo_menu = SubmenuBuilder::new(handle, "Repository")
        .item(
            &MenuItemBuilder::with_id("fetch", "Fetch")
                .accelerator("CmdOrCtrl+Shift+F")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("pull", "Pull")
                .accelerator("CmdOrCtrl+Shift+L")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("push", "Push")
                .accelerator("CmdOrCtrl+Shift+P")
                .build(handle)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id("new-branch", "New Branch…")
                .accelerator("CmdOrCtrl+B")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("new-tag", "New Tag…")
                .accelerator("CmdOrCtrl+T")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("create-stash", "Stash Changes…")
                .accelerator("CmdOrCtrl+S")
                .build(handle)?,
        )
        .build()?;

    let window_menu = SubmenuBuilder::new(handle, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    MenuBuilder::new(handle)
        .items(&[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &repo_menu,
            &window_menu,
        ])
        .build()
}

pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let id = event.id().0.as_str();
    let _ = app.emit(&format!("menu://{}", id), ());
}
