import { invoke } from "@tauri-apps/api/core";

export type RepoInfo = {
  path: string;
  headRef: string | null;
  headCommitId: string | null;
  isDetached: boolean;
};

export type CommitSummary = {
  id: string;
  shortId: string;
  summary: string;
  authorName: string;
  authorEmail: string;
  timestamp: number;
  committerName: string;
  committerEmail: string;
  committerTimestamp: number;
  parentIds: string[];
};

export type ChangeStatus = "added" | "deleted" | "modified" | "renamed" | "copied";

export type FileChange = {
  path: string;
  oldPath: string | null;
  status: ChangeStatus;
};

export type DiffLineKind = "context" | "addition" | "deletion";

export type DiffLine = {
  kind: DiffLineKind;
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type LfsPointer = { oid: string; size: number };
export type ImageDimensions = { width: number; height: number };

export type FileDiff = {
  path: string;
  oldPath: string | null;
  isBinary: boolean;
  hunks: DiffHunk[];
  mediaMimeType?: string;
  oldMedia?: string;
  newMedia?: string;
  oldSize?: number;
  newSize?: number;
  oldDimensions?: ImageDimensions;
  newDimensions?: ImageDimensions;
  isLfs?: boolean;
  oldLfsPointer?: LfsPointer | null;
  newLfsPointer?: LfsPointer | null;
};

export type StatusEntry = {
  path: string;
  oldPath: string | null;
  code: string;
};

export type RepoStatus = {
  staged: StatusEntry[];
  unstaged: StatusEntry[];
  untracked: StatusEntry[];
  conflicted: StatusEntry[];
};

export const api = {
  openRepo: (path: string) => invoke<RepoInfo>("cmd_open_repo", { path }),
  closeRepo: (path: string) => invoke<void>("cmd_close_repo", { path }),
  commitLog: (
    path: string,
    limit = 200,
    skip = 0,
    query: string | null = null,
    allBranches = false,
  ) =>
    invoke<CommitSummary[]>("cmd_commit_log", {
      path,
      limit,
      skip,
      query,
      allBranches,
    }),
  commitMessage: (path: string, commitId: string) =>
    invoke<string>("cmd_commit_message", { path, commitId }),
  commitChanges: (path: string, commitId: string) =>
    invoke<FileChange[]>("cmd_commit_changes", { path, commitId }),
  fileDiff: (path: string, commitId: string, filePath: string) =>
    invoke<FileDiff>("cmd_file_diff", { path, commitId, filePath }),
  status: (path: string) => invoke<RepoStatus>("cmd_status", { path }),
  workingDiff: (path: string, filePath: string, staged: boolean) =>
    invoke<FileDiff>("cmd_working_diff", { path, filePath, staged }),
};
