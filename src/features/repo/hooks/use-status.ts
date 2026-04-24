import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

function pluralize(n: number, singular: string, plural = `${singular}s`) {
  return n === 1 ? singular : plural;
}

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
  });
}

export function useStageActions(path: string | null) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["status", path] });
    qc.invalidateQueries({ queryKey: ["working-diff", path] });
  };

  return {
    stage: useMutation({
      mutationFn: (paths: string[]) => api.stagePaths(path as string, paths),
      onSuccess: (_d, paths) => {
        invalidate();
        toast.success(`Staged ${paths.length} ${pluralize(paths.length, "file")}`);
      },
      onError: toastGitError,
    }),
    unstage: useMutation({
      mutationFn: (paths: string[]) => api.unstagePaths(path as string, paths),
      onSuccess: (_d, paths) => {
        invalidate();
        toast.success(`Unstaged ${paths.length} ${pluralize(paths.length, "file")}`);
      },
      onError: toastGitError,
    }),
    discard: useMutation({
      mutationFn: (paths: string[]) => api.discardPaths(path as string, paths),
      onSuccess: (_d, paths) => {
        invalidate();
        toast.success(`Discarded changes in ${paths.length} ${pluralize(paths.length, "file")}`);
      },
      onError: toastGitError,
    }),
    applyPatch: useMutation({
      mutationFn: (vars: { patch: string; cached: boolean; reverse: boolean; toast: string }) =>
        api.applyPatch(path as string, vars.patch, vars.cached, vars.reverse),
      onSuccess: (_d, vars) => {
        invalidate();
        toast.success(vars.toast);
      },
      onError: toastGitError,
    }),
  };
}

export function useCommit(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
      api.commit(path as string, message, amend),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["status", path] });
      qc.invalidateQueries({ queryKey: ["commit-log", path] });
      qc.invalidateQueries({ queryKey: ["refs", path] });
      qc.invalidateQueries({ queryKey: ["upstream-status", path] });
      toast.success(vars.amend ? "Amended last commit" : "Commit created");
    },
    onError: toastGitError,
  });
}
