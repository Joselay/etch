import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useRefs(path: string | null) {
  return useQuery({
    queryKey: ["refs", path],
    enabled: !!path,
    queryFn: () => api.listRefs(path as string),
  });
}
