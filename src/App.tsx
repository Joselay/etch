import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ThemeProvider } from "next-themes";
import { useCallback, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CloneDialog } from "@/features/repo/components/clone-dialog";
import { RepoLayout } from "@/features/repo/components/repo-layout";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { useInitRepo } from "@/features/repo/hooks/use-clone-repo";
import { useOpenRepo } from "@/features/repo/hooks/use-open-repo";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useMenuEvents } from "@/hooks/use-menu-events";
import { useThemeShortcut } from "@/hooks/use-theme-shortcut";
import { onMenuEvent } from "@/lib/menu-events";
import { persister, queryClient, shouldPersistQuery } from "@/lib/query-client";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import "./App.css";

// Bump when the persisted query shape changes to discard stale caches.
const CACHE_BUSTER = "v1";

function AppInner() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const selectCommit = useSelectionStore((s) => s.selectCommit);
  const cloneOpen = useUiStore((s) => s.cloneOpen);
  const setCloneOpen = useUiStore((s) => s.setCloneOpen);

  useGlobalRefresh();
  useMenuEvents();
  useThemeShortcut();

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
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [pickAndOpen, pickAndInit, setCloneOpen]);

  const activePath = activeRepo?.path ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: activePath is only a trigger — we reset selection whenever the active repo changes.
  useEffect(() => {
    selectCommit(null);
  }, [activePath, selectCommit]);

  return (
    <>
      {activeRepo ? <RepoLayout /> : <WelcomeScreen />}
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
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
