import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type ResolveSide, toastGitError } from "@/lib/tauri";

export function useConflicts(path: string | null) {
  return useQuery({
    queryKey: ["conflicts", path],
    enabled: !!path,
    queryFn: () => api.listConflicts(path as string),
    refetchOnWindowFocus: true,
  });
}

export function useConflictSides(path: string | null, file: string | null) {
  return useQuery({
    queryKey: ["conflict-sides", path, file],
    enabled: !!path && !!file,
    queryFn: () => api.conflictSides(path as string, file as string),
  });
}

function invalidateConflict(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["conflicts", path] });
  qc.invalidateQueries({ queryKey: ["conflict-sides", path] });
  qc.invalidateQueries({ queryKey: ["repo-state", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["working-diff", path] });
}

export function useConflictActions(path: string) {
  const qc = useQueryClient();

  return {
    resolveWith: useMutation({
      mutationFn: (vars: { file: string; side: ResolveSide }) =>
        api.resolveWith(path, vars.file, vars.side),
      onSuccess: (_d, vars) => {
        invalidateConflict(qc, path);
        toast.success(`Used ${vars.side} for ${vars.file}`);
      },
      onError: toastGitError,
    }),
    resolveWithContent: useMutation({
      mutationFn: (vars: { file: string; content: string }) =>
        api.resolveWithContent(path, vars.file, vars.content),
      onSuccess: (_d, vars) => {
        invalidateConflict(qc, path);
        toast.success(`Resolved ${vars.file}`);
      },
      onError: toastGitError,
    }),
    markResolved: useMutation({
      mutationFn: (files: string[]) => api.markResolved(path, files),
      onSuccess: (_d, files) => {
        invalidateConflict(qc, path);
        toast.success(`Marked ${files.length} resolved`);
      },
      onError: toastGitError,
    }),
    unmark: useMutation({
      mutationFn: (files: string[]) => api.unmarkConflict(path, files),
      onSuccess: () => {
        invalidateConflict(qc, path);
      },
      onError: toastGitError,
    }),
  };
}
