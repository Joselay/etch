import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useUpstreamStatus(path: string | null) {
  return useQuery({
    queryKey: ["upstream-status", path],
    enabled: !!path,
    queryFn: () => api.upstreamStatus(path as string),
    refetchOnWindowFocus: true,
  });
}

function invalidateRemoteState(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["upstream-status", path] });
  qc.invalidateQueries({ queryKey: ["repo", path] });
}

export function useFetch(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { remote?: string | null; prune?: boolean } = {}) =>
      api.fetch(path, vars.remote ?? null, vars.prune ?? true),
    onSuccess: () => {
      invalidateRemoteState(qc, path);
      toast.success("Fetched from remote");
    },
    onError: toastGitError,
  });
}

export function usePull(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { ffOnly?: boolean } = {}) => api.pull(path, vars.ffOnly ?? true),
    onSuccess: () => {
      invalidateRemoteState(qc, path);
      toast.success("Pulled from remote");
    },
    onError: toastGitError,
  });
}

export function usePush(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      vars: {
        remote?: string | null;
        branch?: string | null;
        setUpstream?: boolean;
        forceWithLease?: boolean;
      } = {},
    ) => api.push(path, vars),
    onSuccess: () => {
      invalidateRemoteState(qc, path);
      toast.success("Pushed to remote");
    },
    onError: toastGitError,
  });
}
