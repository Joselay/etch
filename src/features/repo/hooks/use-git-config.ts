import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useGitConfigList(path: string | null, global = false) {
  return useQuery({
    queryKey: ["git-config", path, global],
    enabled: global || !!path,
    queryFn: () => api.listGitConfig(global ? null : (path as string), global),
  });
}

export function useGitConfigEntry(path: string | null, key: string, global = false) {
  return useQuery({
    queryKey: ["git-config-entry", path, key, global],
    enabled: !!key && (global || !!path),
    queryFn: () => api.readGitConfig(global ? null : (path as string), key, global),
  });
}

export function useWriteGitConfig(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, value, global }: { key: string; value: string; global: boolean }) =>
      api.writeGitConfig(global ? null : (path as string), key, value, global),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["git-config"] });
      qc.invalidateQueries({ queryKey: ["git-config-entry"] });
      qc.invalidateQueries({ queryKey: ["signing-config"] });
      qc.invalidateQueries({ queryKey: ["crlf-config"] });
      toast.success(`Saved ${vars.key}`);
    },
    onError: toastGitError,
  });
}

export function useUnsetGitConfig(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, global }: { key: string; global: boolean }) =>
      api.unsetGitConfig(global ? null : (path as string), key, global),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["git-config"] });
      qc.invalidateQueries({ queryKey: ["git-config-entry"] });
      qc.invalidateQueries({ queryKey: ["signing-config"] });
      qc.invalidateQueries({ queryKey: ["crlf-config"] });
    },
    onError: toastGitError,
  });
}

export function useCrlfConfig(path: string | null) {
  return useQuery({
    queryKey: ["crlf-config", path],
    enabled: !!path,
    queryFn: () => api.readCrlfConfig(path as string),
    staleTime: 30_000,
  });
}
