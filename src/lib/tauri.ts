import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";

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
  imageMimeType?: string;
  oldImage?: string;
  newImage?: string;
  oldSize?: number;
  newSize?: number;
  oldDimensions?: ImageDimensions;
  newDimensions?: ImageDimensions;
};

export type ImageDimensions = {
  width: number;
  height: number;
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

export type RemoteAuthor = {
  email: string;
  login: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

export type UpstreamStatus = {
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  detached: boolean;
};

export type ProviderToken = {
  host: string;
  label: string;
  tokenHelpUrl: string;
  hasToken: boolean;
};

// Matches the "auth error:" prefix produced by AppError::Auth's Display impl
// (src-tauri/src/error.rs). Keep in sync if that variant is renamed.
export function isAuthError(err: unknown): boolean {
  const msg = typeof err === "string" ? err : (err as { message?: string } | null)?.message;
  return typeof msg === "string" && msg.startsWith("auth error:");
}

export function errorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  return (err as { message?: string } | null)?.message ?? "unknown error";
}

export function toastGitError(err: unknown) {
  toast.error(errorMessage(err));
}

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
  applyPatch: (path: string, patch: string, cached: boolean, reverse: boolean) =>
    invoke<void>("cmd_apply_patch", { path, patch, cached, reverse }),
  commit: (path: string, message: string, amend: boolean) =>
    invoke<CommitResult>("cmd_commit", { path, message, amend }),
  createBranch: (path: string, name: string, startPoint: string | null) =>
    invoke<void>("cmd_create_branch", { path, name, startPoint }),
  checkout: (path: string, target: string, create: boolean) =>
    invoke<void>("cmd_checkout", { path, target, create }),
  checkoutTracking: (path: string, localName: string, upstream: string) =>
    invoke<void>("cmd_checkout_tracking", { path, localName, upstream }),
  deleteBranch: (path: string, name: string, force: boolean) =>
    invoke<void>("cmd_delete_branch", { path, name, force }),
  renameBranch: (path: string, oldName: string, newName: string, force: boolean) =>
    invoke<void>("cmd_rename_branch", { path, oldName, newName, force }),
  upstreamStatus: (path: string) => invoke<UpstreamStatus>("cmd_upstream_status", { path }),
  fetch: (path: string, remote: string | null = null, prune = true) =>
    invoke<void>("cmd_fetch", { path, remote, prune }),
  pull: (path: string, ffOnly = true) => invoke<void>("cmd_pull", { path, ffOnly }),
  push: (
    path: string,
    opts: {
      remote?: string | null;
      branch?: string | null;
      setUpstream?: boolean;
      forceWithLease?: boolean;
    } = {},
  ) =>
    invoke<void>("cmd_push", {
      path,
      remote: opts.remote ?? null,
      branch: opts.branch ?? null,
      setUpstream: opts.setUpstream ?? false,
      forceWithLease: opts.forceWithLease ?? false,
    }),
  remoteAuthors: (path: string) => invoke<RemoteAuthor[]>("cmd_remote_authors", { path }),
  listProviderTokens: () => invoke<ProviderToken[]>("cmd_list_provider_tokens"),
  setProviderToken: (host: string, token: string) =>
    invoke<void>("cmd_set_provider_token", { host, token }),
  clearProviderToken: (host: string) => invoke<void>("cmd_clear_provider_token", { host }),
};
