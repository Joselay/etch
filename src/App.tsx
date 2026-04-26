import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { ThemeProvider } from "next-themes";
import { useCallback, useEffect } from "react";
import { ShortcutsDialog } from "@/components/shortcuts-dialog";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CloneDialog } from "@/features/repo/components/clone-dialog";
import { RepoLayout } from "@/features/repo/components/repo-layout";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { useInitRepo } from "@/features/repo/hooks/use-clone-repo";
import { useOpenRepo } from "@/features/repo/hooks/use-open-repo";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useCommandShortcuts } from "@/hooks/use-command-shortcuts";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useMenuEvents } from "@/hooks/use-menu-events";
import { useThemeShortcut } from "@/hooks/use-theme-shortcut";
import { onMenuEvent } from "@/lib/menu-events";
import { persister, queryClient, shouldPersistQuery } from "@/lib/query-client";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";
import "./App.css";

// Bump when the persisted query shape changes to discard stale caches.
const CACHE_BUSTER = "v1";

function AppInner() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const cloneOpen = useModalStore((s) => s.cloneOpen);
  const setCloneOpen = useModalStore((s) => s.setCloneOpen);

  useGlobalRefresh();
  useMenuEvents();
  useThemeShortcut();
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
    ];
    return () => {
      for (const off of offs) off();
    };
  }, [pickAndOpen, pickAndInit, setCloneOpen]);

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
          <ShortcutsDialog />
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
