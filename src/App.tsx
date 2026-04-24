import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { RepoLayout } from "@/features/repo/components/repo-layout";
import { WelcomeScreen } from "@/features/repo/components/welcome-screen";
import { queryClient } from "@/lib/query-client";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import "./App.css";

function AppInner() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const selectCommit = useSelectionStore((s) => s.selectCommit);

  const activePath = activeRepo?.path ?? null;
  useEffect(() => {
    if (activePath !== null) selectCommit(null);
    else selectCommit(null);
  }, [activePath, selectCommit]);

  return activeRepo ? <RepoLayout /> : <WelcomeScreen />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppInner />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
