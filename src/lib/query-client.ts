import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

export const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "loom-query-cache",
});

// Only persist queries that are expensive to refetch and safe across restarts.
// Everything else (status, diffs, refs) stays in-memory and is cheap to reload.
const PERSISTED_KEYS = new Set(["remote-authors"]);

export function shouldPersistQuery(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return typeof head === "string" && PERSISTED_KEYS.has(head);
}
