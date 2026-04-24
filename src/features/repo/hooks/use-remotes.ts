import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useRemotes(path: string | null) {
  return useQuery({
    queryKey: ["remotes", path],
    enabled: !!path,
    queryFn: () => api.listRemotes(path as string),
    staleTime: 1000 * 30,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["remotes", path] });
  qc.invalidateQueries({ queryKey: ["refs", path] });
}

export function useAddRemote(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; url: string }) => api.addRemote(path, vars.name, vars.url),
    onSuccess: (_d, vars) => {
      invalidate(qc, path);
      toast.success(`Added remote ${vars.name}`);
    },
    onError: toastGitError,
  });
}

export function useRemoveRemote(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.removeRemote(path, name),
    onSuccess: (_d, name) => {
      invalidate(qc, path);
      toast.success(`Removed remote ${name}`);
    },
    onError: toastGitError,
  });
}

export function useRenameRemote(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { oldName: string; newName: string }) =>
      api.renameRemote(path, vars.oldName, vars.newName),
    onSuccess: (_d, vars) => {
      invalidate(qc, path);
      toast.success(`Renamed to ${vars.newName}`);
    },
    onError: toastGitError,
  });
}

export function useSetRemoteUrl(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string; url: string; push?: boolean }) =>
      api.setRemoteUrl(path, vars.name, vars.url, vars.push ?? false),
    onSuccess: (_d, vars) => {
      invalidate(qc, path);
      toast.success(`Updated ${vars.name} URL`);
    },
    onError: toastGitError,
  });
}
