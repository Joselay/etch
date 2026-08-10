import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Git query payloads can contain large diffs and commit pages. Keeping
      // every previously viewed item for React Query's five-minute default
      // causes the webview's memory to grow quickly during normal browsing.
      gcTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "etch-query-cache",
});

// Only persist queries that are expensive to refetch and safe across restarts.
// Everything else (status, diffs, refs) stays in-memory and is cheap to reload.
const PERSISTED_KEYS = new Set(["remote-authors"]);

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return typeof head === "string" && PERSISTED_KEYS.has(head);
}
