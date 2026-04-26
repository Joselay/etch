import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type BisectVerdict, toastGitError } from "@/lib/tauri";

export function useBisectLog(path: string | null) {
  return useQuery({
    queryKey: ["bisect-log", path],
    enabled: !!path,
    queryFn: () => api.bisectLog(path as string),
  });
}

function invalidateBisect(qc: ReturnType<typeof useQueryClient>, path: string) {
  qc.invalidateQueries({ queryKey: ["bisect-log", path] });
  qc.invalidateQueries({ queryKey: ["repo-state", path] });
  qc.invalidateQueries({ queryKey: ["refs", path] });
  qc.invalidateQueries({ queryKey: ["status", path] });
}

export function useBisectStart(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bad, good }: { bad: string; good: string }) => api.bisectStart(path, bad, good),
    onSuccess: (status) => {
      invalidateBisect(qc, path);
      if (status.remainingSteps != null) {
        toast.success(`Bisect started — ~${status.remainingSteps} steps remaining`);
      } else {
        toast.success("Bisect started");
      }
    },
    onError: toastGitError,
  });
}

export function useBisectMark(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (verdict: BisectVerdict) => api.bisectMark(path, verdict),
    onSuccess: (status) => {
      invalidateBisect(qc, path);
      if (status.foundCommit) {
        toast.success(`First bad commit: ${status.foundCommit.slice(0, 7)}`);
      }
    },
    onError: toastGitError,
  });
}
