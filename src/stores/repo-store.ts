import { load, type Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { create } from "zustand";
import { api, type RepoInfo } from "@/lib/tauri";

export type RecentRepo = { path: string; lastOpenedAt: number };

type RepoState = {
  openRepos: RepoInfo[];
  activeRepo: RepoInfo | null;
  recentRepos: RecentRepo[];
  hydrated: boolean;
  welcomeTabOpen: boolean;
  setActive: (repo: RepoInfo) => Promise<void>;
  setActivePath: (path: string | null) => Promise<void>;
  closeRepo: (path: string) => Promise<void>;
  reorderRepos: (fromPath: string, toPath: string) => Promise<void>;
  clearActive: () => Promise<void>;
  refreshRepo: (path: string) => Promise<void>;
  hydrate: () => Promise<void>;
  removeRecent: (path: string) => Promise<void>;
  openWelcomeTab: () => Promise<void>;
  closeWelcomeTab: () => Promise<void>;
};

const STORE_FILE = "etch.store.json";
const RECENTS_KEY = "recentRepos";
const OPEN_PATHS_KEY = "openRepoPaths";
const ACTIVE_PATH_KEY = "activeRepoPath";
const MAX_RECENTS = 10;

let storePromise: Promise<Store> | null = null;
let hydrationPromise: Promise<void> | null = null;
const getStore = () => {
  storePromise ??= load(STORE_FILE, { autoSave: true, defaults: {} });
  return storePromise;
};

async function persistSession(openPaths: string[], activePath: string | null) {
  try {
    const store = await getStore();
    await store.set(OPEN_PATHS_KEY, openPaths);
    await store.set(ACTIVE_PATH_KEY, activePath);
  } catch (error) {
    console.error("Failed to persist repository session", error);
  }
}

export const useRepoStore = create<RepoState>((set, get) => ({
  openRepos: [],
  activeRepo: null,
  recentRepos: [],
  hydrated: false,
  welcomeTabOpen: false,

  hydrate: async () => {
    if (get().hydrated) return;
    hydrationPromise ??= (async () => {
      try {
        const store = await getStore();
        const recents = (await store.get<RecentRepo[]>(RECENTS_KEY)) ?? [];
        const openPaths = (await store.get<string[]>(OPEN_PATHS_KEY)) ?? [];
        const activePath = (await store.get<string | null>(ACTIVE_PATH_KEY)) ?? null;
        const results = await Promise.all(
          openPaths.map(async (path) => {
            try {
              return await api.openRepo(path);
            } catch (error) {
              console.warn(`Skipping unavailable repository: ${path}`, error);
              return null;
            }
          }),
        );
        const openRepos = results.filter((repo): repo is RepoInfo => repo !== null);
        const skipped = openPaths.length - openRepos.length;
        if (skipped > 0) {
          toast.warning(
            `${skipped} repositor${skipped === 1 ? "y" : "ies"} could not be reopened.`,
          );
        }
        const activeRepo =
          openRepos.find((repo) => repo.path === activePath) ??
          openRepos[openRepos.length - 1] ??
          null;
        set({ recentRepos: recents, openRepos, activeRepo, hydrated: true });
        await persistSession(
          openRepos.map((repo) => repo.path),
          activeRepo?.path ?? null,
        );
      } catch (error) {
        console.error("Failed to restore repositories", error);
        set({ hydrated: true });
      }
    })();
    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  setActive: async (repo) => {
    const state = get();
    const openRepos = state.openRepos.some((item) => item.path === repo.path)
      ? state.openRepos.map((item) => (item.path === repo.path ? repo : item))
      : [...state.openRepos, repo];
    const recentRepos = [
      { path: repo.path, lastOpenedAt: Date.now() },
      ...state.recentRepos.filter((item) => item.path !== repo.path),
    ].slice(0, MAX_RECENTS);
    const consumeWelcome = state.welcomeTabOpen && state.activeRepo === null;
    set({
      openRepos,
      activeRepo: repo,
      recentRepos,
      welcomeTabOpen: consumeWelcome ? false : state.welcomeTabOpen,
    });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recentRepos);
    } catch (error) {
      console.error("Failed to persist recent repositories", error);
    }
    await persistSession(
      openRepos.map((item) => item.path),
      repo.path,
    );
  },

  setActivePath: async (path) => {
    const { openRepos } = get();
    const activeRepo = path ? (openRepos.find((repo) => repo.path === path) ?? null) : null;
    if (path && !activeRepo) return;
    set({ activeRepo });
    await persistSession(
      openRepos.map((repo) => repo.path),
      activeRepo?.path ?? null,
    );
  },

  closeRepo: async (path) => {
    const { openRepos, activeRepo, welcomeTabOpen } = get();
    const remaining = openRepos.filter((repo) => repo.path !== path);
    const nextActive =
      activeRepo?.path === path
        ? welcomeTabOpen
          ? null
          : (remaining[remaining.length - 1] ?? null)
        : activeRepo;
    set({ openRepos: remaining, activeRepo: nextActive });
    await persistSession(
      remaining.map((repo) => repo.path),
      nextActive?.path ?? null,
    );
    try {
      await api.closeRepo(path);
    } catch (error) {
      console.error("Failed to stop repository watcher", error);
    }
  },

  reorderRepos: async (fromPath, toPath) => {
    if (fromPath === toPath) return;
    const { openRepos, activeRepo } = get();
    const from = openRepos.findIndex((repo) => repo.path === fromPath);
    const to = openRepos.findIndex((repo) => repo.path === toPath);
    if (from < 0 || to < 0) return;
    const reordered = [...openRepos];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    set({ openRepos: reordered });
    await persistSession(
      reordered.map((repo) => repo.path),
      activeRepo?.path ?? null,
    );
  },

  clearActive: async () => {
    const activeRepo = get().activeRepo;
    if (activeRepo) await get().closeRepo(activeRepo.path);
  },

  refreshRepo: async (path) => {
    if (!get().openRepos.some((repo) => repo.path === path)) return;
    try {
      const refreshed = await api.openRepo(path);
      if (!get().openRepos.some((repo) => repo.path === path)) {
        await api.closeRepo(path);
        return;
      }
      set((state) => ({
        openRepos: state.openRepos.map((repo) => (repo.path === path ? refreshed : repo)),
        activeRepo: state.activeRepo?.path === path ? refreshed : state.activeRepo,
      }));
    } catch (error) {
      console.error(`Failed to refresh repository metadata: ${path}`, error);
    }
  },

  openWelcomeTab: async () => {
    const { openRepos } = get();
    set({ welcomeTabOpen: true, activeRepo: null });
    await persistSession(
      openRepos.map((repo) => repo.path),
      null,
    );
  },

  closeWelcomeTab: async () => {
    const { welcomeTabOpen, activeRepo, openRepos } = get();
    if (!welcomeTabOpen) return;
    const nextActive = activeRepo ?? openRepos[openRepos.length - 1] ?? null;
    set({ welcomeTabOpen: false, activeRepo: nextActive });
    await persistSession(
      openRepos.map((repo) => repo.path),
      nextActive?.path ?? null,
    );
  },

  removeRecent: async (path) => {
    const recentRepos = get().recentRepos.filter((repo) => repo.path !== path);
    set({ recentRepos });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recentRepos);
    } catch (error) {
      console.error("Failed to persist recent repositories", error);
    }
  },
}));
