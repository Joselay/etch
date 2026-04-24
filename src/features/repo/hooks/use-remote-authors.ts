import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";
import { toast } from "sonner";
import { api, errorMessage, isAuthError } from "@/lib/tauri";
import { useUiStore } from "@/stores/ui-store";
import type { RemoteAuthorsContextValue } from "../remote-authors-context";

export function remoteAuthorsQueryOptions(path: string) {
  return {
    queryKey: ["remote-authors", path] as const,
    queryFn: () => api.remoteAuthors(path),
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 * 2,
    retry: false,
  };
}

export function useRemoteAuthors(path: string | null) {
  const openSettings = useUiStore((s) => s.openSettings);
  const query = useQuery({
    ...remoteAuthorsQueryOptions(path ?? ""),
    queryKey: ["remote-authors", path],
    enabled: !!path,
  });

  const lastToastedError = useRef<string | null>(null);
  useEffect(() => {
    const err = query.error;
    if (!err) {
      lastToastedError.current = null;
      return;
    }
    const msg = errorMessage(err);
    if (lastToastedError.current === msg) return;
    lastToastedError.current = msg;

    if (isAuthError(err)) {
      toast.error(msg, {
        action: { label: "Open settings", onClick: () => openSettings() },
        duration: 8000,
      });
    }
    // swallow non-auth errors (e.g. no github remote) — not actionable
  }, [query.error, openSettings]);

  return query;
}

export function useRemoteAuthorsContextValue(path: string | null): RemoteAuthorsContextValue {
  const { data, isLoading, isFetching, isError } = useRemoteAuthors(path);
  return useMemo(() => {
    const map = new Map<string, string>();
    if (data) {
      for (const a of data) {
        if (a.avatarUrl) map.set(a.email.toLowerCase(), a.avatarUrl);
      }
    }
    // "Settled" = we have a result (data or error) AND we aren't in the middle of
    // a fresh fetch for a new path. Until then, avatars should avoid guessing with
    // Gravatar identicons that will flicker once real data arrives.
    const hasResult = data !== undefined || isError;
    const isSettled = hasResult && !isLoading && !isFetching;
    return { map, isSettled };
  }, [data, isLoading, isFetching, isError]);
}
