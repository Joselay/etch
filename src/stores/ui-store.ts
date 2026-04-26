import { create } from "zustand";
import { persist } from "zustand/middleware";

export type DiffLayout = "unified" | "split";

type UiState = {
  settingsOpen: boolean;
  openSettings: () => void;
  setSettingsOpen: (open: boolean) => void;
  paletteOpen: boolean;
  openPalette: () => void;
  togglePalette: () => void;
  setPaletteOpen: (open: boolean) => void;
  cloneOpen: boolean;
  setCloneOpen: (open: boolean) => void;
  shortcutsOpen: boolean;
  openShortcuts: () => void;
  toggleShortcuts: () => void;
  setShortcutsOpen: (open: boolean) => void;
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
      settingsOpen: false,
      openSettings: () => set({ settingsOpen: true }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      paletteOpen: false,
      openPalette: () => set({ paletteOpen: true }),
      togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),
      setPaletteOpen: (open) => set({ paletteOpen: open }),
      cloneOpen: false,
      setCloneOpen: (open) => set({ cloneOpen: open }),
      shortcutsOpen: false,
      openShortcuts: () => set({ shortcutsOpen: true }),
      toggleShortcuts: () => set((s) => ({ shortcutsOpen: !s.shortcutsOpen })),
      setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
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
    {
      name: "etch-ui",
      partialize: (s) => ({
        diffWordWrap: s.diffWordWrap,
        diffLineNumbers: s.diffLineNumbers,
        diffLayout: s.diffLayout,
        diffWordHighlight: s.diffWordHighlight,
        commitLogAllBranches: s.commitLogAllBranches,
      }),
    },
  ),
);
