import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useStatus(path: string | null) {
  return useQuery({
    queryKey: ["status", path],
    enabled: !!path,
    queryFn: () => api.status(path as string),
  });
}

export function useWorkingDiff(path: string | null, filePath: string | null, staged: boolean) {
  return useQuery({
    queryKey: ["working-diff", path, filePath, staged],
    enabled: !!path && !!filePath,
    queryFn: () => api.workingDiff(path as string, filePath as string, staged),
    gcTime: 15_000,
  });
}
