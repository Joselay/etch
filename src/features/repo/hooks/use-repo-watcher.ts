import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

type RepoChange = {
  head: boolean;
  refs: boolean;
  index: boolean;
  worktree: boolean;
  state: boolean;
  stash: boolean;
  config: boolean;
};

export function useRepoWatcher(repoPath: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!repoPath) return;
    const unlistenPromise = listen<RepoChange>("repo-changed", (e) => {
      const c = e.payload;
      if (c.index || c.worktree) {
        qc.invalidateQueries({ queryKey: ["status", repoPath] });
        qc.invalidateQueries({ queryKey: ["working-diff", repoPath] });
      }
      if (c.head || c.refs) {
        qc.invalidateQueries({ queryKey: ["commit-log", repoPath] });
        qc.invalidateQueries({ queryKey: ["refs", repoPath] });
        qc.invalidateQueries({ queryKey: ["upstream-status", repoPath] });
        qc.invalidateQueries({ queryKey: ["reflog", repoPath] });
      }
      if (c.state) {
        qc.invalidateQueries({ queryKey: ["repo-state", repoPath] });
        qc.invalidateQueries({ queryKey: ["conflicts", repoPath] });
        qc.invalidateQueries({ queryKey: ["conflict-sides", repoPath] });
      }
      if (c.stash) {
        qc.invalidateQueries({ queryKey: ["stashes", repoPath] });
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [qc, repoPath]);
}
