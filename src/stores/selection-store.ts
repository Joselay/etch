import { create } from "zustand";

type SelectionState = {
  selectedCommitId: string | null;
  selectedFilePath: string | null;
  selectCommit: (id: string | null) => void;
  selectFile: (path: string | null) => void;
};

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedCommitId: null,
  selectedFilePath: null,
  selectCommit: (id) => set({ selectedCommitId: id, selectedFilePath: null }),
  selectFile: (path) => set({ selectedFilePath: path }),
}));
