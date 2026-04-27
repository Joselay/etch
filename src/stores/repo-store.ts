import { load, type Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import { create } from "zustand";
import { api, type RepoInfo } from "@/lib/tauri";

type RecentRepo = { path: string; lastOpenedAt: number; remoteUrl?: string };

type RepoState = {
  openRepos: RepoInfo[];
  activeRepo: RepoInfo | null;
  recentRepos: RecentRepo[];
  hydrated: boolean;
  welcomeTabOpen: boolean;
  setActive: (repo: RepoInfo) => Promise<void>;
  setActivePath: (path: string | null) => Promise<void>;
  closeRepo: (path: string) => Promise<void>;
  clearActive: () => Promise<void>;
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
const getStore = () => {
  if (!storePromise) storePromise = load(STORE_FILE, { autoSave: true, defaults: {} });
  return storePromise;
};

const persistSession = async (openPaths: string[], activePath: string | null) => {
  try {
    const store = await getStore();
    await store.set(OPEN_PATHS_KEY, openPaths);
    await store.set(ACTIVE_PATH_KEY, activePath);
  } catch (err) {
    console.error("Failed to persist session", err);
  }
};

export const useRepoStore = create<RepoState>((set, get) => ({
  openRepos: [],
  activeRepo: null,
  recentRepos: [],
  hydrated: false,
  welcomeTabOpen: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const store = await getStore();
      const recents = (await store.get<RecentRepo[]>(RECENTS_KEY)) ?? [];
      const openPaths = (await store.get<string[]>(OPEN_PATHS_KEY)) ?? [];
      const activePath = (await store.get<string | null>(ACTIVE_PATH_KEY)) ?? null;

      const results = await Promise.all(
        openPaths.map(async (path) => {
          try {
            return await api.openRepo(path);
          } catch (err) {
            console.warn(`Skipping unavailable repo: ${path}`, err);
            return null;
          }
        }),
      );
      const restored = results.filter((r): r is RepoInfo => r !== null);
      const skipped = openPaths.length - restored.length;
      if (skipped > 0) {
        toast.warning(
          `${skipped} repo${skipped === 1 ? "" : "s"} could not be reopened (moved or deleted).`,
        );
      }
      const active =
        restored.find((r) => r.path === activePath) ??
        (restored.length > 0 ? restored[restored.length - 1] : null);

      set({
        recentRepos: recents,
        openRepos: restored,
        activeRepo: active,
        hydrated: true,
      });

      const restoredPaths = restored.map((r) => r.path);
      if (restoredPaths.length !== openPaths.length || (active?.path ?? null) !== activePath) {
        await persistSession(restoredPaths, active?.path ?? null);
      }
    } catch (err) {
      console.error("Failed to hydrate repo store", err);
      set({ hydrated: true });
    }
  },

  setActive: async (repo) => {
    const now = Date.now();
    const { openRepos, recentRepos, welcomeTabOpen, activeRepo } = get();
    // Opening a repo from the welcome tab consumes that tab slot (browser-style).
    const consumeWelcome = welcomeTabOpen && activeRepo === null;
    const filteredRecents = recentRepos.filter((r) => r.path !== repo.path);
    const previousRemoteUrl = recentRepos.find((r) => r.path === repo.path)?.remoteUrl;
    const recents = [
      { path: repo.path, lastOpenedAt: now, remoteUrl: previousRemoteUrl },
      ...filteredRecents,
    ].slice(0, MAX_RECENTS);
    const existsIdx = openRepos.findIndex((r) => r.path === repo.path);
    const next =
      existsIdx >= 0
        ? openRepos.map((r) => (r.path === repo.path ? repo : r))
        : [...openRepos, repo];
    set({
      openRepos: next,
      activeRepo: repo,
      recentRepos: recents,
      welcomeTabOpen: consumeWelcome ? false : welcomeTabOpen,
    });
    try {
      const store = await getStore();
      await store.set(RECENTS_KEY, recents);
    } catch (err) {
      console.error("Failed to persist recent repos", err);
    }
    await persistSession(
      next.map((r) => r.path),
      repo.path,
    );
    // Best-effort remote URL capture for the welcome screen / switcher provider icon.
    void (async () => {
      try {
        const remotes = await api.listRemotes(repo.path);
        const url = (remotes.find((r) => r.name === "origin") ?? remotes[0])?.url ?? null;
        if (!url) return;
        const current = get().recentRepos;
        const updated = current.map((r) => (r.path === repo.path ? { ...r, remoteUrl: url } : r));
        if (updated.some((r, i) => r.remoteUrl !== current[i]?.remoteUrl)) {
          set({ recentRepos: updated });
          const store = await getStore();
          await store.set(RECENTS_KEY, updated);
        }
      } catch {
        // best-effort; missing remote URL just means no provider icon
      }
    })();
  },

  setActivePath: async (path) => {
    const { openRepos } = get();
    if (!path) {
      set({ activeRepo: null });
      await persistSession(
        openRepos.map((r) => r.path),
        null,
      );
      return;
    }
    const repo = openRepos.find((r) => r.path === path);
    if (!repo) return;
    set({ activeRepo: repo });
    await persistSession(
      openRepos.map((r) => r.path),
      repo.path,
    );
  },

  closeRepo: async (path) => {
    const { openRepos, activeRepo, welcomeTabOpen } = get();
    const remaining = openRepos.filter((r) => r.path !== path);
    let nextActive = activeRepo;
    if (activeRepo?.path === path) {
      // Prefer falling back to the welcome tab if it's open; otherwise the most recent repo.
      nextActive = welcomeTabOpen
        ? null
        : remaining.length > 0
          ? remaining[remaining.length - 1]
          : null;
    }
    set({ openRepos: remaining, activeRepo: nextActive });
    await persistSession(
      remaining.map((r) => r.path),
      nextActive?.path ?? null,
    );
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

  openWelcomeTab: async () => {
    const { welcomeTabOpen, openRepos } = get();
    set({ welcomeTabOpen: true, activeRepo: null });
    if (!welcomeTabOpen) {
      await persistSession(
        openRepos.map((r) => r.path),
        null,
      );
    }
  },

  closeWelcomeTab: async () => {
    const { welcomeTabOpen, activeRepo, openRepos } = get();
    if (!welcomeTabOpen) return;
    // If the welcome tab was the active tab, fall back to the most recent repo.
    const nextActive =
      activeRepo ?? (openRepos.length > 0 ? openRepos[openRepos.length - 1] : null);
    set({ welcomeTabOpen: false, activeRepo: nextActive });
    await persistSession(
      openRepos.map((r) => r.path),
      nextActive?.path ?? null,
    );
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
