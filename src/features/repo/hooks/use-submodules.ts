import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useSubmodules(path: string | null) {
  return useQuery({
    queryKey: ["submodules", path],
    enabled: !!path,
    queryFn: () => api.listSubmodules(path as string),
    staleTime: 30_000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["submodules", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
}

export function useUpdateSubmodule(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sub, init }: { sub: string; init: boolean }) =>
      api.updateSubmodule(path, sub, init),
    onSuccess: (_d, vars) => {
      invalidate(qc, path);
      toast.success(`Updated ${vars.sub}`);
    },
    onError: toastGitError,
  });
}

export function useInitSubmodule(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sub: string) => api.initSubmodule(path, sub),
    onSuccess: (_d, sub) => {
      invalidate(qc, path);
      toast.success(`Initialized ${sub}`);
    },
    onError: toastGitError,
  });
}

export function useSyncSubmodules(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.syncSubmodules(path),
    onSuccess: () => {
      invalidate(qc, path);
      toast.success("Synced submodule URLs");
    },
    onError: toastGitError,
  });
}
