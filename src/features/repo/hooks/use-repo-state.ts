import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useRepoState(path: string | null) {
  return useQuery({
    queryKey: ["repo-state", path],
    enabled: !!path,
    queryFn: () => api.repoState(path as string),
    refetchOnWindowFocus: true,
  });
}

// Abort/continue all change working tree + refs; invalidate broadly.
function invalidateEverything(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["repo-state", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["commit-log", path] });
  qc.invalidateQueries({ queryKey: ["upstream-status", path] });
  qc.invalidateQueries({ queryKey: ["working-diff", path] });
}

type Op = "merge" | "revert" | "cherryPick";

const labels: Record<Op, { aborted: string; continued: string }> = {
  merge: { aborted: "Aborted merge", continued: "Merge committed" },
  revert: { aborted: "Aborted revert", continued: "Revert committed" },
  cherryPick: { aborted: "Aborted cherry-pick", continued: "Cherry-pick committed" },
};

export function useAbortOp(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op: Op) => {
      if (op === "merge") return api.abortMerge(path);
      if (op === "revert") return api.abortRevert(path);
      return api.abortCherryPick(path);
    },
    onSuccess: (_d, op) => {
      invalidateEverything(qc, path);
      toast.success(labels[op].aborted);
    },
    onError: toastGitError,
  });
}

export function useContinueOp(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (op: Op) => {
      if (op === "revert") return api.continueRevert(path);
      if (op === "cherryPick") return api.continueCherryPick(path);
      return api.continueMerge(path);
    },
    onSuccess: (_d, op) => {
      invalidateEverything(qc, path);
      toast.success(labels[op].continued);
    },
    onError: toastGitError,
  });
}
