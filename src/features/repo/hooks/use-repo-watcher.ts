import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

export function useRepoWatcher(repoPath: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!repoPath) return;
    const unlistenPromise = listen("repo-changed", () => {
      qc.invalidateQueries({ queryKey: ["status", repoPath] });
      qc.invalidateQueries({ queryKey: ["commit-log", repoPath] });
      qc.invalidateQueries({ queryKey: ["refs", repoPath] });
      qc.invalidateQueries({ queryKey: ["upstream-status", repoPath] });
      qc.invalidateQueries({ queryKey: ["working-diff", repoPath] });
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [qc, repoPath]);
}
