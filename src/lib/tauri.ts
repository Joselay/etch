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
  parentIds: string[];
};

export type BranchRef = {
  name: string;
  fullName: string;
  target: string | null;
  isHead: boolean;
  remote: string | null;
};

export type TagRef = {
  name: string;
  fullName: string;
  target: string | null;
};

export type RefListing = {
  local: BranchRef[];
  remote: BranchRef[];
  tags: TagRef[];
  headRef: string | null;
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

export type FileDiff = {
  path: string;
  oldPath: string | null;
  isBinary: boolean;
  hunks: DiffHunk[];
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

export type CommitResult = { id: string };

export const api = {
  openRepo: (path: string) => invoke<RepoInfo>("cmd_open_repo", { path }),
  commitLog: (path: string, limit = 200, skip = 0) =>
    invoke<CommitSummary[]>("cmd_commit_log", { path, limit, skip }),
  listRefs: (path: string) => invoke<RefListing>("cmd_list_refs", { path }),
  commitChanges: (path: string, commitId: string) =>
    invoke<FileChange[]>("cmd_commit_changes", { path, commitId }),
  fileDiff: (path: string, commitId: string, filePath: string) =>
    invoke<FileDiff>("cmd_file_diff", { path, commitId, filePath }),
  status: (path: string) => invoke<RepoStatus>("cmd_status", { path }),
  workingDiff: (path: string, filePath: string, staged: boolean) =>
    invoke<FileDiff>("cmd_working_diff", { path, filePath, staged }),
  stagePaths: (path: string, paths: string[]) => invoke<void>("cmd_stage_paths", { path, paths }),
  unstagePaths: (path: string, paths: string[]) =>
    invoke<void>("cmd_unstage_paths", { path, paths }),
  discardPaths: (path: string, paths: string[]) =>
    invoke<void>("cmd_discard_paths", { path, paths }),
  commit: (path: string, message: string, amend: boolean) =>
    invoke<CommitResult>("cmd_commit", { path, message, amend }),
};
