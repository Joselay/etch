import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";
import { toastUndoable } from "@/lib/undo-toast";

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
    mutationFn: (vars: { name: string; target: string | null }) =>
      api.deleteTag(path, vars.name).then(() => vars),
    onSuccess: (_d, vars) => {
      invalidateTags(qc, path);
      if (!vars.target) {
        toast.success(`Deleted tag ${vars.name}`);
        return;
      }
      const target = vars.target;
      toastUndoable(`Deleted tag ${vars.name}`, async () => {
        try {
          await api.createTag(path, vars.name, null, target, false);
          invalidateTags(qc, path);
          toast.success(`Restored tag ${vars.name}`);
        } catch (err) {
          toastGitError(err);
        }
      });
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
