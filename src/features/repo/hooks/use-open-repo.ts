import { useQueryClient } from "@tanstack/react-query";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri";
import { useRepoStore } from "@/stores/repo-store";
import { remoteAuthorsQueryOptions } from "./use-remote-authors";

export function useOpenRepo() {
  const setActive = useRepoStore((s) => s.setActive);
  const queryClient = useQueryClient();
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAt = useCallback(
    async (path: string) => {
      setIsOpening(true);
      setError(null);
      try {
        const info = await api.openRepo(path);
        // Kick off the remote-authors fetch in parallel with setActive so the
        // network round-trip runs while RepoLayout mounts rather than after.
        void queryClient.prefetchQuery(remoteAuthorsQueryOptions(path));
        await setActive(info);
        return info;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Couldn't open repository: ${msg}`);
        throw e;
      } finally {
        setIsOpening(false);
      }
    },
    [setActive, queryClient],
  );

  const pickAndOpen = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return null;
    return openAt(selected);
  }, [openAt]);

  return { pickAndOpen, openAt, isOpening, error };
}
