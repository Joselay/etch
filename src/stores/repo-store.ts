import { load, type Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import { api, type RepoInfo } from "@/lib/tauri";

type RecentRepo = { path: string; lastOpenedAt: number };

type RepoState = {
  openRepos: RepoInfo[];
  activeRepo: RepoInfo | null;
  recentRepos: RecentRepo[];
  hydrated: boolean;
  setActive: (repo: RepoInfo) => Promise<void>;
  setActivePath: (path: string | null) => void;
  closeRepo: (path: string) => Promise<void>;
  clearActive: () => Promise<void>;
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
  openRepos: [],
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
    const { openRepos, recentRepos } = get();
    const filteredRecents = recentRepos.filter((r) => r.path !== repo.path);
    const recents = [{ path: repo.path, lastOpenedAt: now }, ...filteredRecents].slice(
      0,
      MAX_RECENTS,
    );
    const existsIdx = openRepos.findIndex((r) => r.path === repo.path);
    const next =
      existsIdx >= 0
        ? openRepos.map((r) => (r.path === repo.path ? repo : r))
        : [...openRepos, repo];
    set({ openRepos: next, activeRepo: repo, recentRepos: recents });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recents);
    } catch (err) {
      console.error("Failed to persist recent repos", err);
    }
  },

  setActivePath: (path) => {
    const { openRepos } = get();
    if (!path) {
      set({ activeRepo: null });
      return;
    }
    const repo = openRepos.find((r) => r.path === path);
    if (!repo) return;
    set({ activeRepo: repo });
  },

  closeRepo: async (path) => {
    const { openRepos, activeRepo } = get();
    const remaining = openRepos.filter((r) => r.path !== path);
    let nextActive = activeRepo;
    if (activeRepo?.path === path) {
      nextActive = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }
    set({ openRepos: remaining, activeRepo: nextActive });
    try {
      await api.closeRepo(path);
    } catch (err) {
      console.error("Failed to close repo watcher", err);
    }
  },

  clearActive: async () => {
    const { activeRepo } = get();
    if (!activeRepo) return;
    await get().closeRepo(activeRepo.path);
  },

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
