import { create } from "zustand";
import type { CommitSummary } from "@/lib/tauri";

export type RepoView = "history" | "changes" | "reflog";

export type WorkingSide = "staged" | "unstaged";

type SelectionState = {
  view: RepoView;
  selectedCommitId: string | null;
  selectedCommit: CommitSummary | null;
  selectedFilePath: string | null;
  workingSide: WorkingSide;
  workingFilePath: string | null;
  setView: (view: RepoView) => void;
  selectCommit: (id: string | null, summary?: CommitSummary | null) => void;
  selectFile: (path: string | null) => void;
  selectWorkingFile: (side: WorkingSide, path: string | null) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  view: "history",
  selectedCommitId: null,
  selectedCommit: null,
  selectedFilePath: null,
  workingSide: "unstaged",
  workingFilePath: null,
  setView: (view) => set({ view }),
  selectCommit: (id, summary = null) =>
    set({ selectedCommitId: id, selectedCommit: summary, selectedFilePath: null }),
  selectFile: (path) => set({ selectedFilePath: path }),
  selectWorkingFile: (side, path) => set({ workingSide: side, workingFilePath: path }),
}));
