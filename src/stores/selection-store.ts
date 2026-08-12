import { create } from "zustand";
import type { CommitSummary } from "@/lib/tauri";
import { useRepoStore } from "./repo-store";

export type RepoView = "history" | "changes";

export type WorkingSide = "staged" | "unstaged";

export type TabSelection = {
  view: RepoView;
  selectedCommitId: string | null;
  selectedCommit: CommitSummary | null;
  selectedFilePath: string | null;
  workingSide: WorkingSide;
  workingFilePath: string | null;
};

const defaultTab = (): TabSelection => ({
  view: "history",
  selectedCommitId: null,
  selectedCommit: null,
  selectedFilePath: null,
  workingSide: "unstaged",
  workingFilePath: null,
});

type SelectionState = {
  tabs: Record<string, TabSelection>;
  ensureTab: (path: string) => void;
  removeTab: (path: string) => void;
  setView: (path: string, view: RepoView) => void;
  selectCommit: (path: string, id: string | null, summary?: CommitSummary | null) => void;
  selectFile: (path: string, file: string | null) => void;
  selectWorkingFile: (path: string, side: WorkingSide, file: string | null) => void;
};

export const useSelectionStore = create<SelectionState>((set, get) => ({
  tabs: {},

  ensureTab: (path) => {
    if (get().tabs[path]) return;
    set((s) => ({ tabs: { ...s.tabs, [path]: defaultTab() } }));
  },

  removeTab: (path) => {
    set((s) => {
      if (!s.tabs[path]) return s;
      const next = { ...s.tabs };
      delete next[path];
      return { tabs: next };
    });
  },

  setView: (path, view) =>
    set((s) => ({
      tabs: { ...s.tabs, [path]: { ...(s.tabs[path] ?? defaultTab()), view } },
    })),

  selectCommit: (path, id, summary = null) =>
    set((s) => ({
      tabs: {
        ...s.tabs,
        [path]: {
          ...(s.tabs[path] ?? defaultTab()),
          selectedCommitId: id,
          selectedCommit: summary,
          selectedFilePath: null,
        },
      },
    })),

  selectFile: (path, file) =>
    set((s) => ({
      tabs: {
        ...s.tabs,
        [path]: { ...(s.tabs[path] ?? defaultTab()), selectedFilePath: file },
      },
    })),

  selectWorkingFile: (path, side, file) =>
    set((s) => ({
      tabs: {
        ...s.tabs,
        [path]: {
          ...(s.tabs[path] ?? defaultTab()),
          workingSide: side,
          workingFilePath: file,
        },
      },
    })),
}));

export function useTabSelection(path: string | null): TabSelection {
  return useSelectionStore((s) => (path ? (s.tabs[path] ?? defaultTab()) : defaultTab()));
}

export function useActiveTab(): TabSelection {
  const activePath = useRepoStore((s) => s.activeRepo?.path ?? null);
  return useTabSelection(activePath);
}
