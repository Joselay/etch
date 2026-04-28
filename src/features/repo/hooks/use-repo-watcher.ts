import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";

type RepoChange = {
  path: string;
  head: boolean;
  refs: boolean;
  index: boolean;
  worktree: boolean;
  state: boolean;
  stash: boolean;
  config: boolean;
  bisect?: boolean;
};

export function useRepoWatcher(repoPath: string | null) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!repoPath) return;
    const unlistenPromise = listen<RepoChange>("repo-changed", (e) => {
      const c = e.payload;
      if (c.path && c.path !== repoPath) return;
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
      if (c.bisect) {
        qc.invalidateQueries({ queryKey: ["bisect-log", repoPath] });
      }
      if (c.config) {
        qc.invalidateQueries({ queryKey: ["git-config", repoPath] });
        qc.invalidateQueries({ queryKey: ["signing-config", repoPath] });
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [qc, repoPath]);
}

export function RepoWatcher({ path }: { path: string }) {
  useRepoWatcher(path);
  return null;
}
