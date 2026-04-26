import { create } from "zustand";
import { persist } from "zustand/middleware";

type State = {
  collapsed: Record<string, string[]>;
  toggle: (key: string, path: string) => void;
};

export const useFileTreeStore = create<State>()(
  persist(
    (set) => ({
      collapsed: {},
      toggle: (key, path) =>
        set((s) => {
          const current = new Set(s.collapsed[key] ?? []);
          if (current.has(path)) current.delete(path);
          else current.add(path);
          return { collapsed: { ...s.collapsed, [key]: [...current] } };
        }),
    }),
    {
      name: "etch-file-tree",
      partialize: (s) => ({ collapsed: s.collapsed }),
    },
  ),
);
