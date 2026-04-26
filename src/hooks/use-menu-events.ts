import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { dispatchMenuEvent, MENU_EVENTS, type MenuEventName } from "@/lib/menu-events";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";

function handle(name: MenuEventName): void {
  const ui = useUiStore.getState();
  const repo = useRepoStore.getState();
  const selection = useSelectionStore.getState();

  switch (name) {
    case "settings":
      ui.openSettings();
      return;
    case "command-palette":
      if (repo.activeRepo) ui.togglePalette();
      return;
    case "view-history":
      if (repo.activeRepo) selection.setView(repo.activeRepo.path, "history");
      return;
    case "view-changes":
      if (repo.activeRepo) selection.setView(repo.activeRepo.path, "changes");
      return;
    case "toggle-word-wrap":
      ui.toggleDiffWordWrap();
      return;
    case "toggle-line-numbers":
      ui.toggleDiffLineNumbers();
      return;
    default:
      // close-repo and other component-scoped events fall through to
      // dispatchMenuEvent so the owning component can apply local logic
      // (e.g. RepoLayout warns about uncommitted changes before closing).
      dispatchMenuEvent(name);
  }
}

export function useMenuEvents(): void {
  useEffect(() => {
    const pending: Promise<UnlistenFn>[] = MENU_EVENTS.map((name) =>
      listen(`menu://${name}`, () => handle(name)),
    );
    return () => {
      for (const p of pending) {
        p.then((fn) => fn()).catch((err) => console.error("menu unlisten failed", err));
      }
    };
  }, []);
}
