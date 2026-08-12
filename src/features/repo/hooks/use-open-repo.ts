import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri";
import { useRepoStore } from "@/stores/repo-store";

export function useOpenRepo() {
  const setActive = useRepoStore((state) => state.setActive);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAt = useCallback(
    async (path: string) => {
      setIsOpening(true);
      setError(null);
      try {
        const repo = await api.openRepo(path);
        await setActive(repo);
        return repo;
      } catch (cause) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        toast.error(`Couldn't open repository: ${message}`);
        throw cause;
      } finally {
        setIsOpening(false);
      }
    },
    [setActive],
  );

  const pickAndOpen = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected !== "string") return null;
    return openAt(selected);
  }, [openAt]);

  return { pickAndOpen, openAt, isOpening, error };
}
