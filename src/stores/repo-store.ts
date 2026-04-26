import { load, type Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import type { RepoInfo } from "@/lib/tauri";

type RecentRepo = { path: string; lastOpenedAt: number };

type RepoState = {
  activeRepo: RepoInfo | null;
  recentRepos: RecentRepo[];
  hydrated: boolean;
  setActive: (repo: RepoInfo) => Promise<void>;
  clearActive: () => void;
  hydrate: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
};

const STORE_FILE = "etch.store.json";
const RECENTS_KEY = "recentRepos";
const MAX_RECENTS = 10;

let storePromise: Promise<Store> | null = null;
const getStore = () => {
  if (!storePromise) storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  return storePromise;
};

export const useRepoStore = create<RepoState>((set, get) => ({
  activeRepo: null,
  recentRepos: [],
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const store = await getStore();
      const recents = (await store.get<RecentRepo[]>(RECENTS_KEY)) ?? [];
      set({ recentRepos: recents, hydrated: true });
    } catch (err) {
      console.error("Failed to hydrate repo store", err);
      set({ hydrated: true });
    }
  },

  setActive: async (repo) => {
    const now = Date.now();
    const existing = get().recentRepos.filter((r) => r.path !== repo.path);
    const recents = [{ path: repo.path, lastOpenedAt: now }, ...existing].slice(0, MAX_RECENTS);
    set({ activeRepo: repo, recentRepos: recents });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recents);
    } catch (err) {
      console.error("Failed to persist recent repos", err);
    }
  },

  clearActive: () => set({ activeRepo: null }),

  removeRecent: async (path) => {
    const recents = get().recentRepos.filter((r) => r.path !== path);
    set({ recentRepos: recents });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recents);
    } catch (err) {
      console.error("Failed to persist recent repos", err);
    }
  },
}));
