import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useStashes(path: string | null) {
  return useQuery({
    queryKey: ["stashes", path],
    enabled: !!path,
    queryFn: () => api.listStashes(path as string),
  });
}

// After a stash mutation the working copy + index change, so invalidate
// anything that reflects them.
function invalidateAll(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["stashes", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["working-diff", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["refs", path] });
}

export function useCreateStash(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      message: string | null;
      includeUntracked: boolean;
      keepIndex: boolean;
      paths?: string[];
    }) =>
      api.createStash(
        path as string,
        vars.message,
        vars.includeUntracked,
        vars.keepIndex,
        vars.paths && vars.paths.length > 0 ? vars.paths : null,
      ),
    onSuccess: () => {
      if (path) invalidateAll(qc, path);
      toast.success("Stashed changes");
    },
    onError: toastGitError,
  });
}

export function useApplyStash(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refName: string) => api.applyStash(path as string, refName),
    onSuccess: (_d, refName) => {
      if (path) invalidateAll(qc, path);
      toast.success(`Applied ${refName}`);
    },
    onError: toastGitError,
  });
}

export function usePopStash(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refName: string) => api.popStash(path as string, refName),
    onSuccess: (_d, refName) => {
      if (path) invalidateAll(qc, path);
      toast.success(`Popped ${refName}`);
    },
    onError: toastGitError,
  });
}

export function useDropStash(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refName: string) => api.dropStash(path as string, refName),
    onSuccess: (_d, refName) => {
      if (path) invalidateAll(qc, path);
      toast.success(`Dropped ${refName}`);
    },
    onError: toastGitError,
  });
}
