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

export function useRepoWatcher() {
  const qc = useQueryClient();

  useEffect(() => {
    const unlistenPromise = listen<RepoChange>("repo-changed", (e) => {
      const c = e.payload;
      // Watcher payloads normally include a path. Falling back to the query
      // family still refreshes safely if an older backend emits no path.
      const key = (name: string) => (c.path ? [name, c.path] : [name]);
      if (c.index || c.worktree) {
        qc.invalidateQueries({ queryKey: key("status") });
        qc.invalidateQueries({ queryKey: key("working-diff") });
      }
      if (c.head || c.refs) {
        qc.invalidateQueries({ queryKey: key("commit-log") });
        qc.invalidateQueries({ queryKey: key("refs") });
        qc.invalidateQueries({ queryKey: key("upstream-status") });
        qc.invalidateQueries({ queryKey: key("reflog") });
      }
      if (c.state) {
        qc.invalidateQueries({ queryKey: key("repo-state") });
        qc.invalidateQueries({ queryKey: key("conflicts") });
        qc.invalidateQueries({ queryKey: key("conflict-sides") });
      }
      if (c.stash) {
        qc.invalidateQueries({ queryKey: key("stashes") });
      }
      if (c.bisect) {
        qc.invalidateQueries({ queryKey: key("bisect-log") });
      }
      if (c.config) {
        qc.invalidateQueries({ queryKey: key("git-config") });
        qc.invalidateQueries({ queryKey: key("signing-config") });
      }
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
  }, [qc]);
}

export function RepoWatcher() {
  useRepoWatcher();
  return null;
}
