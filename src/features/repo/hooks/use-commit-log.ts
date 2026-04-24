import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useCommitLog(path: string | null, limit = 500) {
  return useQuery({
    queryKey: ["commit-log", path, limit],
    enabled: !!path,
    queryFn: () => api.commitLog(path as string, limit, 0),
  });
}
