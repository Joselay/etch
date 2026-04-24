import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/tauri";
import { useRepoStore } from "@/stores/repo-store";
import { remoteAuthorsQueryOptions } from "./use-remote-authors";

export function useCloneRepo() {
  const setActive = useRepoStore((s) => s.setActive);
  const queryClient = useQueryClient();
  const [isCloning, setIsCloning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cloneTo = useCallback(
    async (url: string, dest: string) => {
      setIsCloning(true);
      setError(null);
      try {
        const info = await api.cloneRepo(url, dest);
        void queryClient.prefetchQuery(remoteAuthorsQueryOptions(info.path));
        await setActive(info);
        toast.success(`Cloned into ${info.path}`);
        return info;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Clone failed: ${msg}`);
        throw e;
      } finally {
        setIsCloning(false);
      }
    },
    [setActive, queryClient],
  );

  return { cloneTo, isCloning, error };
}

export function useInitRepo() {
  const setActive = useRepoStore((s) => s.setActive);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initAt = useCallback(
    async (path: string) => {
      setIsInitializing(true);
      setError(null);
      try {
        const info = await api.initRepo(path);
        await setActive(info);
        toast.success(`Initialized repo at ${info.path}`);
        return info;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        toast.error(`Init failed: ${msg}`);
        throw e;
      } finally {
        setIsInitializing(false);
      }
    },
    [setActive],
  );

  return { initAt, isInitializing, error };
}
