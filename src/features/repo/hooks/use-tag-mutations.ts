import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

function invalidateTags(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["refs", path] });
}

export function useCreateTag(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      name: string;
      message: string | null;
      target: string | null;
      force: boolean;
    }) => api.createTag(path, vars.name, vars.message, vars.target, vars.force),
    onSuccess: (_d, vars) => {
      invalidateTags(qc, path);
      toast.success(`Created tag ${vars.name}`);
    },
    onError: toastGitError,
  });
}

export function useDeleteTag(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.deleteTag(path, name),
    onSuccess: (_d, name) => {
      invalidateTags(qc, path);
      toast.success(`Deleted tag ${name}`);
    },
    onError: toastGitError,
  });
}

export function usePushTag(path: string) {
  return useMutation({
    mutationFn: (vars: { remote: string; name: string; deleteRemote?: boolean }) =>
      api.pushTag(path, vars.remote, vars.name, vars.deleteRemote ?? false),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.deleteRemote
          ? `Deleted ${vars.name} on ${vars.remote}`
          : `Pushed ${vars.name} to ${vars.remote}`,
      );
    },
    onError: toastGitError,
  });
}
