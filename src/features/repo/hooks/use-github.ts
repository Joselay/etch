import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function usePullRequests(path: string | null, branch: string | null) {
  return useQuery({
    queryKey: ["prs", path, branch],
    enabled: !!path && !!branch,
    queryFn: () => api.listPrs(path as string, branch as string),
    staleTime: 60_000,
    retry: 0,
  });
}

export function useCiStatus(path: string | null, ref: string | null) {
  return useQuery({
    queryKey: ["ci-status", path, ref],
    enabled: !!path && !!ref,
    queryFn: () => api.ciStatus(path as string, ref as string),
    staleTime: 30_000,
    retry: 0,
  });
}
