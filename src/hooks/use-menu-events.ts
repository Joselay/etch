import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { dispatchMenuEvent, MENU_EVENTS, type MenuEventName } from "@/lib/menu-events";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";

function handle(name: MenuEventName): void {
  const repoPath = useRepoStore.getState().activeRepo?.path;
  const selection = useSelectionStore.getState();
  const ui = useUiStore.getState();

  switch (name) {
    case "view-history":
      if (repoPath) selection.setView(repoPath, "history");
      return;
    case "view-changes":
      if (repoPath) selection.setView(repoPath, "changes");
      return;
    case "toggle-word-wrap":
      ui.toggleDiffWordWrap();
      return;
    case "toggle-line-numbers":
      ui.toggleDiffLineNumbers();
      return;
    default:
      dispatchMenuEvent(name);
  }
}

export function useMenuEvents(): void {
  useEffect(() => {
    const pending: Promise<UnlistenFn>[] = MENU_EVENTS.map((name) =>
      listen(`menu://${name}`, () => handle(name)),
    );
    return () => {
      for (const listener of pending) {
        listener.then((unlisten) => unlisten()).catch(console.error);
      }
    };
  }, []);
}
