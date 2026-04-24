import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/tauri";

export function useGitIdentity(repoPath: string | null) {
  return useQuery({
    queryKey: ["git-identity", repoPath],
    queryFn: () => api.readIdentity(repoPath),
    staleTime: 1000 * 30,
  });
}

export function useWriteGitIdentity(repoPath: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { name: string | null; email: string | null }) =>
      api.writeIdentity(repoPath, vars.name, vars.email),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["git-identity"] });
      toast.success(repoPath ? "Saved repo identity" : "Saved global identity");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}
