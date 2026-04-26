import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, toastGitError } from "@/lib/tauri";

export function useGitignore(path: string | null) {
  return useQuery({
    queryKey: ["gitignore", path],
    enabled: !!path,
    queryFn: () => api.readGitignore(path as string),
  });
}

export function useWriteGitignore(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => api.writeGitignore(path, content),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["gitignore", path] });
      qc.invalidateQueries({ queryKey: ["status", path] });
      toast.success(".gitignore saved");
    },
    onError: toastGitError,
  });
}

export function useAppendGitignore(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (pattern: string) => api.appendGitignore(path, pattern),
    onSuccess: (_, pattern) => {
      qc.invalidateQueries({ queryKey: ["gitignore", path] });
      qc.invalidateQueries({ queryKey: ["status", path] });
      toast.success(`Added to .gitignore: ${pattern}`);
    },
    onError: toastGitError,
  });
}

export function useUntrackFile(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: string) => api.untrackFile(path, file),
    onSuccess: (_, file) => {
      qc.invalidateQueries({ queryKey: ["status", path] });
      toast.success(`Stopped tracking ${file}`);
    },
    onError: toastGitError,
  });
}
