import { useQueryClient } from "@tanstack/react-query";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useRepoStore } from "@/stores/repo-store";

type RepoChange = {
  path: string;
  head: boolean;
  refs: boolean;
  index: boolean;
  worktree: boolean;
};

export function useRepoWatcher() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unlisten = listen<RepoChange>("repo-changed", ({ payload }) => {
      const key = (name: string) => [name, payload.path];
      if (payload.index || payload.worktree) {
        queryClient.invalidateQueries({ queryKey: key("status") });
        queryClient.invalidateQueries({ queryKey: key("working-diff") });
      }
      if (payload.head || payload.refs) {
        queryClient.invalidateQueries({ queryKey: key("commit-log") });
        void useRepoStore.getState().refreshRepo(payload.path);
      }
    });
    return () => {
      unlisten.then((stop) => stop()).catch(console.error);
    };
  }, [queryClient]);
}

export function RepoWatcher() {
  useRepoWatcher();
  return null;
}
