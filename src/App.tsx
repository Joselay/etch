import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ThemeProvider } from "next-themes";
import { useCallback, useEffect } from "react";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CloneDialog } from "@/features/repo/components/clone-dialog";
import { RepoLayout } from "@/features/repo/components/repo-layout";
import { RepoTabStrip } from "@/features/repo/components/repo-tab-strip";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { useInitRepo } from "@/features/repo/hooks/use-clone-repo";
import { useOpenRepo } from "@/features/repo/hooks/use-open-repo";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useMenuEvents } from "@/hooks/use-menu-events";
import { onMenuEvent } from "@/lib/menu-events";
import { persister, queryClient, shouldPersistQuery } from "@/lib/query-client";
import { checkForUpdates } from "@/lib/updater";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";
import "./App.css";

// Bump when the persisted query shape changes to discard stale caches.
const CACHE_BUSTER = "v1";

function AppInner() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const hydrated = useRepoStore((s) => s.hydrated);
  const hydrate = useRepoStore((s) => s.hydrate);
  const openRepos = useRepoStore((s) => s.openRepos);
  const welcomeTabOpen = useRepoStore((s) => s.welcomeTabOpen);
  const openWelcomeTab = useRepoStore((s) => s.openWelcomeTab);
  const closeWelcomeTab = useRepoStore((s) => s.closeWelcomeTab);
  const cloneOpen = useModalStore((s) => s.cloneOpen);
  const setCloneOpen = useModalStore((s) => s.setCloneOpen);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const t = setTimeout(() => void checkForUpdates({ silent: true }), 3000);
    return () => clearTimeout(t);
  }, []);

  useGlobalRefresh();
  useMenuEvents();
  useCommandShortcuts();

  const { pickAndOpen } = useOpenRepo();
  const { initAt } = useInitRepo();

  const pickAndInit = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected !== "string") return;
    try {
      await initAt(selected);
    } catch {
      // toast already shown
    }
  }, [initAt]);

  useEffect(() => {
    const offs = [
      onMenuEvent("open-repo", () => void pickAndOpen()),
      onMenuEvent("new-repo", () => void pickAndInit()),
      onMenuEvent("clone-repo", () => setCloneOpen(true)),
      onMenuEvent("new-tab", () => void openWelcomeTab()),
      // Close-repo on the welcome tab (no active repo) closes the welcome tab.
      // When a repo is active, RepoLayout handles close-repo (with a dirty check).
      onMenuEvent("close-repo", () => {
        const { activeRepo: a, welcomeTabOpen: w } = useRepoStore.getState();
        if (!a && w) void closeWelcomeTab();
      }),
      onMenuEvent("check-updates", () => void checkForUpdates({ silent: false })),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [pickAndOpen, pickAndInit, setCloneOpen, openWelcomeTab, closeWelcomeTab]);

  if (!hydrated) {
    return null;
  }

  const showTabStrip = openRepos.length + (welcomeTabOpen ? 1 : 0) > 1;

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden">
        {showTabStrip && <RepoTabStrip />}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeRepo ? <RepoLayout /> : <WelcomeScreen />}
        </div>
      </div>
      <CloneDialog open={cloneOpen} onOpenChange={setCloneOpen} />
    </>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          buster: CACHE_BUSTER,
          maxAge: 1000 * 60 * 60 * 24 * 7,
          dehydrateOptions: {
            shouldDehydrateQuery: (q) =>
              q.state.status === "success" && shouldPersistQuery(q.queryKey),
          },
        }}
      >
        <TooltipProvider delayDuration={200}>
          <AppInner />
          <SettingsDialog />
          <ShortcutsDialog />
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
