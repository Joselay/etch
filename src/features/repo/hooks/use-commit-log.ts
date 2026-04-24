import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useCommitLog(path: string | null, query: string | null = null, limit = 500) {
  const trimmed = query?.trim() ? query.trim() : null;
  return useQuery({
    queryKey: ["commit-log", path, limit, trimmed],
    enabled: !!path,
    queryFn: () => api.commitLog(path as string, limit, 0, trimmed),
    // Keep prior results visible while the user is typing.
    placeholderData: (prev) => prev,
  });
}
