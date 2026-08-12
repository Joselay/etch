import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { RepoTabStrip } from "@/features/repo/components/repo-tab-strip";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { useOpenRepo } from "@/features/repo/hooks/use-open-repo";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { useMenuEvents } from "@/hooks/use-menu-events";
import { onMenuEvent } from "@/lib/menu-events";
import { queryClient } from "@/lib/query-client";
import { useRepoStore } from "@/stores/repo-store";
import "./App.css";

const RepoLayout = lazy(() =>
  import("@/features/repo/components/repo-layout").then((module) => ({
    default: module.RepoLayout,
  })),
);

function AppInner() {
  const activeRepo = useRepoStore((state) => state.activeRepo);
  const hydrated = useRepoStore((state) => state.hydrated);
  const hydrate = useRepoStore((state) => state.hydrate);
  const openRepos = useRepoStore((state) => state.openRepos);
  const welcomeTabOpen = useRepoStore((state) => state.welcomeTabOpen);
  const openWelcomeTab = useRepoStore((state) => state.openWelcomeTab);
  const closeWelcomeTab = useRepoStore((state) => state.closeWelcomeTab);
  const { pickAndOpen } = useOpenRepo();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useGlobalRefresh();
  useMenuEvents();

  useEffect(() => {
    const unsubscribe = [
      onMenuEvent("open-repo", () => void pickAndOpen()),
      onMenuEvent("new-tab", () => void openWelcomeTab()),
      onMenuEvent("close-repo", () => {
        const store = useRepoStore.getState();
        if (store.activeRepo) void store.clearActive();
        else if (store.welcomeTabOpen) void closeWelcomeTab();
      }),
    ];
    return () => {
      for (const off of unsubscribe) off();
    };
  }, [pickAndOpen, openWelcomeTab, closeWelcomeTab]);

  if (!hydrated) return null;

  const showTabStrip = openRepos.length + (welcomeTabOpen ? 1 : 0) > 1;

  return (
    <>
      <div className="flex h-screen flex-col overflow-hidden">
        {showTabStrip && <RepoTabStrip />}
        <div className="flex min-h-0 flex-1 flex-col">
          {activeRepo ? (
            <Suspense fallback={<div className="h-full bg-background" />}>
              <RepoLayout />
            </Suspense>
          ) : (
            <WelcomeScreen />
          )}
        </div>
      </div>
      <Toaster />
    </>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={200}>
          <AppInner />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
