import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

export function useGlobalRefresh() {
  const qc = useQueryClient();
  const togglePalette = useUiStore((s) => s.togglePalette);
  const toggleCommitLogAllBranches = useUiStore((s) => s.toggleCommitLogAllBranches);
  const setView = useSelectionStore((s) => s.setView);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      // Reload: ⌘R / Ctrl+R / F5 (always, even in inputs)
      const key = e.key.toLowerCase();
      if ((mod && !e.altKey && key === "r") || e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        void qc.invalidateQueries();
        toast.success("Refreshed", { duration: 1200 });
        return;
      }

      if (!mod) return;

      // ⌘K: open command palette
      if (key === "k" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        togglePalette();
        return;
      }

      // The rest skip typing contexts so users can still type normally in
      // inputs (e.g., branch name fields, commit messages).
      if (isTypingTarget(e.target)) return;

      // ⌘⇧B: toggle commit-log scope (current branch ↔ all branches)
      if (key === "b" && !e.altKey && e.shiftKey) {
        e.preventDefault();
        toggleCommitLogAllBranches();
        return;
      }
      // ⌘1 / ⌘2: view switch
      if (key === "1" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setView("history");
        return;
      }
      if (key === "2" && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setView("changes");
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [qc, togglePalette, toggleCommitLogAllBranches, setView]);
}
