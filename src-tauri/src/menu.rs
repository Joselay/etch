use tauri::{
    menu::{Menu, MenuBuilder, MenuEvent, MenuItemBuilder, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
};

pub fn build<R: Runtime>(handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_menu = SubmenuBuilder::new(handle, "Etch")
        .about(None)
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
            &MenuItemBuilder::with_id("open-repo", "Open Repository…")
                .accelerator("CmdOrCtrl+O")
                .build(handle)?,
        )
        .item(
            &MenuItemBuilder::with_id("new-tab", "New Tab")
                .accelerator("CmdOrCtrl+T")
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
        .item(&MenuItemBuilder::with_id("view-history", "History").build(handle)?)
        .item(&MenuItemBuilder::with_id("view-changes", "Changes").build(handle)?)
        .separator()
        .item(&MenuItemBuilder::with_id("toggle-word-wrap", "Toggle Diff Word Wrap").build(handle)?)
        .item(
            &MenuItemBuilder::with_id("toggle-line-numbers", "Toggle Diff Line Numbers")
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
        .items(&[&app_menu, &file_menu, &edit_menu, &view_menu, &window_menu])
        .build()
}

pub fn on_event<R: Runtime>(app: &AppHandle<R>, event: MenuEvent) {
    let _ = app.emit(&format!("menu://{}", event.id().0), ());
}
