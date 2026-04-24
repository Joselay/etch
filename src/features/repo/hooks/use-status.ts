import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useStatus(path: string | null) {
  return useQuery({
    queryKey: ["status", path],
    enabled: !!path,
    queryFn: () => api.status(path as string),
    refetchOnWindowFocus: true,
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
      onSuccess: invalidate,
    }),
    unstage: useMutation({
      mutationFn: (paths: string[]) => api.unstagePaths(path as string, paths),
      onSuccess: invalidate,
    }),
    discard: useMutation({
      mutationFn: (paths: string[]) => api.discardPaths(path as string, paths),
      onSuccess: invalidate,
    }),
  };
}

export function useCommit(path: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ message, amend }: { message: string; amend: boolean }) =>
      api.commit(path as string, message, amend),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status", path] });
      qc.invalidateQueries({ queryKey: ["commit-log", path] });
      qc.invalidateQueries({ queryKey: ["refs", path] });
    },
  });
}
