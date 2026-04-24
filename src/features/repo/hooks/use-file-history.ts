import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useFileHistory(path: string | null, file: string | null, limit = 500) {
  return useQuery({
    queryKey: ["file-history", path, file, limit],
    enabled: !!path && !!file,
    queryFn: () => api.fileHistory(path as string, file as string, limit, 0),
  });
}

export function useBlame(path: string | null, file: string | null, rev: string | null = null) {
  return useQuery({
    queryKey: ["blame", path, file, rev],
    enabled: !!path && !!file,
    queryFn: () => api.blame(path as string, file as string, rev),
  });
}
