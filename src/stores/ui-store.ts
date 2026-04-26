import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DiffLayout = "unified" | "split";

// Persisted user preferences. Transient dialog state lives in
// `modal-store.ts` so it isn't restored on app launch.
type UiState = {
  diffWordWrap: boolean;
  toggleDiffWordWrap: () => void;
  diffLineNumbers: boolean;
  toggleDiffLineNumbers: () => void;
  diffLayout: DiffLayout;
  setDiffLayout: (layout: DiffLayout) => void;
  toggleDiffLayout: () => void;
  diffWordHighlight: boolean;
  toggleDiffWordHighlight: () => void;
  commitLogAllBranches: boolean;
  setCommitLogAllBranches: (value: boolean) => void;
  toggleCommitLogAllBranches: () => void;
};

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      diffWordWrap: true,
      toggleDiffWordWrap: () => set((s) => ({ diffWordWrap: !s.diffWordWrap })),
      diffLineNumbers: true,
      toggleDiffLineNumbers: () => set((s) => ({ diffLineNumbers: !s.diffLineNumbers })),
      diffLayout: "unified",
      setDiffLayout: (layout) => set({ diffLayout: layout }),
      toggleDiffLayout: () =>
        set((s) => ({ diffLayout: s.diffLayout === "unified" ? "split" : "unified" })),
      diffWordHighlight: true,
      toggleDiffWordHighlight: () => set((s) => ({ diffWordHighlight: !s.diffWordHighlight })),
      commitLogAllBranches: false,
      setCommitLogAllBranches: (value) => set({ commitLogAllBranches: value }),
      toggleCommitLogAllBranches: () =>
        set((s) => ({ commitLogAllBranches: !s.commitLogAllBranches })),
    }),
    { name: "etch-ui" },
  ),
);
