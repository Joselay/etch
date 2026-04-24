import { create } from "zustand";

export type RepoView = "history" | "changes";

export type WorkingSide = "staged" | "unstaged";

type SelectionState = {
  view: RepoView;
  selectedCommitId: string | null;
  selectedFilePath: string | null;
  workingSide: WorkingSide;
  workingFilePath: string | null;
  setView: (view: RepoView) => void;
  selectCommit: (id: string | null) => void;
  selectFile: (path: string | null) => void;
  selectWorkingFile: (side: WorkingSide, path: string | null) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  view: "history",
  selectedCommitId: null,
  selectedFilePath: null,
  workingSide: "unstaged",
  workingFilePath: null,
  setView: (view) => set({ view }),
  selectCommit: (id) => set({ selectedCommitId: id, selectedFilePath: null }),
  selectFile: (path) => set({ selectedFilePath: path }),
  selectWorkingFile: (side, path) => set({ workingSide: side, workingFilePath: path }),
}));
