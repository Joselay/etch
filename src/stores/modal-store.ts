import { create } from "zustand";

// Transient dialog open/close flags. Deliberately not persisted — we don't
// want the app to relaunch with a modal already open.
type ModalState = {
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
};

export const useModalStore = create<ModalState>()((set) => ({
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
}));
