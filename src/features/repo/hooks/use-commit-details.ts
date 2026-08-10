import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/tauri";

export function useCommitChanges(path: string | null, commitId: string | null) {
  return useQuery({
    queryKey: ["commit-changes", path, commitId],
    enabled: !!path && !!commitId,
    queryFn: () => api.commitChanges(path as string, commitId as string),
    gcTime: 30_000,
  });
}

export function useCommitMessage(path: string | null, commitId: string | null) {
  return useQuery({
    queryKey: ["commit-message", path, commitId],
    enabled: !!path && !!commitId,
    queryFn: () => api.commitMessage(path as string, commitId as string),
    staleTime: 1000 * 60 * 60,
  });
}

export function useFileDiff(path: string | null, commitId: string | null, filePath: string | null) {
  return useQuery({
    queryKey: ["file-diff", path, commitId, filePath],
    enabled: !!path && !!commitId && !!filePath,
    queryFn: () => api.fileDiff(path as string, commitId as string, filePath as string),
    // File diffs may include large text or base64 media. Release inactive
    // entries promptly instead of accumulating them as the selection changes.
    gcTime: 15_000,
  });
}
