import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RepoLayout } from "@/features/repo/components/repo-layout";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { SettingsDialog } from "@/features/settings/components/settings-dialog";
import { useGlobalRefresh } from "@/hooks/use-global-refresh";
import { persister, queryClient, shouldPersistQuery } from "@/lib/query-client";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import "./App.css";

// Bump when the persisted query shape changes to discard stale caches.
const CACHE_BUSTER = "v1";

function AppInner() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const selectCommit = useSelectionStore((s) => s.selectCommit);

  useGlobalRefresh();

  const activePath = activeRepo?.path ?? null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: activePath is only a trigger — we reset selection whenever the active repo changes.
  useEffect(() => {
    selectCommit(null);
  }, [activePath, selectCommit]);

  return activeRepo ? <RepoLayout /> : <WelcomeScreen />;
}

function App() {
  return (
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
      <AppInner />
      <SettingsDialog />
      <Toaster />
    </PersistQueryClientProvider>
  );
}

export default App;
