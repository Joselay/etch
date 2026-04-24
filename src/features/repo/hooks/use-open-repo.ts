import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useCallback, useState } from "react";
import { api } from "@/lib/tauri";
import { useRepoStore } from "@/stores/repo-store";

export function useOpenRepo() {
  const setActive = useRepoStore((s) => s.setActive);
  const [isOpening, setIsOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openAt = useCallback(
    async (path: string) => {
      setIsOpening(true);
      setError(null);
      try {
        const info = await api.openRepo(path);
        await setActive(info);
        return info;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setIsOpening(false);
      }
    },
    [setActive],
  );

  const pickAndOpen = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (!selected || typeof selected !== "string") return null;
    return openAt(selected);
  }, [openAt]);

  return { pickAndOpen, openAt, isOpening, error };
}
