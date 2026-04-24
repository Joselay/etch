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
  headCommitId: string | null;
  isDetached: boolean;
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

export type GitIdentity = {
  name: string | null;
  email: string | null;
};

export type StashEntry = {
  refName: string;
  index: number;
  message: string;
  branch: string | null;
};

export type BlameLine = {
  commitId: string;
  shortId: string;
  authorName: string;
  authorEmail: string;
  authorTime: number;
  summary: string;
  lineNo: number;
  content: string;
};

export type RemoteInfo = {
  name: string;
  url: string;
  pushUrl: string | null;
};

export type ResetMode = "soft" | "mixed" | "hard";

export type ConflictKind =
  | "bothModified"
  | "bothAdded"
  | "bothDeleted"
  | "deletedByUs"
  | "deletedByThem"
  | "addedByUs"
  | "addedByThem"
  | "unknown";

export type ConflictEntry = {
  path: string;
  kind: ConflictKind;
  code: string;
};

export type ConflictSides = {
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  working: string | null;
};

export type ResolveSide = "ours" | "theirs";

export type TodoAction = "pick" | "reword" | "edit" | "squash" | "fixup" | "drop";

export type TodoEntry = {
  action: TodoAction;
  oid: string;
  summary: string;
};

export type RebaseDetail = {
  headName: string | null;
  ontoOid: string | null;
  origHead: string | null;
  currentStep: number | null;
  totalSteps: number | null;
  interactive: boolean;
};

export type RepoState = {
  merging: boolean;
  reverting: boolean;
  cherryPicking: boolean;
  rebasing: boolean;
  bisecting: boolean;
  hasConflicts: boolean;
  rebase: RebaseDetail | null;
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
  cloneRepo: (url: string, dest: string) => invoke<RepoInfo>("cmd_clone_repo", { url, dest }),
  initRepo: (path: string) => invoke<RepoInfo>("cmd_init_repo", { path }),
  readIdentity: (path: string | null = null) => invoke<GitIdentity>("cmd_read_identity", { path }),
  writeIdentity: (path: string | null, name: string | null, email: string | null) =>
    invoke<void>("cmd_write_identity", { path, name, email }),
  listStashes: (path: string) => invoke<StashEntry[]>("cmd_list_stashes", { path }),
  createStash: (
    path: string,
    message: string | null,
    includeUntracked: boolean,
    keepIndex: boolean,
  ) =>
    invoke<void>("cmd_create_stash", {
      path,
      message,
      includeUntracked,
      keepIndex,
    }),
  applyStash: (path: string, refName: string) => invoke<void>("cmd_apply_stash", { path, refName }),
  popStash: (path: string, refName: string) => invoke<void>("cmd_pop_stash", { path, refName }),
  dropStash: (path: string, refName: string) => invoke<void>("cmd_drop_stash", { path, refName }),
  merge: (path: string, target: string, noFf: boolean) =>
    invoke<void>("cmd_merge", { path, target, noFf }),
  revert: (path: string, commit: string, noEdit = true) =>
    invoke<void>("cmd_revert", { path, commit, noEdit }),
  cherryPick: (path: string, commit: string) => invoke<void>("cmd_cherry_pick", { path, commit }),
  abortMerge: (path: string) => invoke<void>("cmd_abort_merge", { path }),
  abortRevert: (path: string) => invoke<void>("cmd_abort_revert", { path }),
  abortCherryPick: (path: string) => invoke<void>("cmd_abort_cherry_pick", { path }),
  continueRevert: (path: string) => invoke<void>("cmd_continue_revert", { path }),
  continueCherryPick: (path: string) => invoke<void>("cmd_continue_cherry_pick", { path }),
  continueMerge: (path: string) => invoke<void>("cmd_continue_merge", { path }),
  startRebase: (path: string, onto: string, upstream: string | null = null) =>
    invoke<void>("cmd_start_rebase", { path, onto, upstream }),
  continueRebase: (path: string) => invoke<void>("cmd_continue_rebase", { path }),
  abortRebase: (path: string) => invoke<void>("cmd_abort_rebase", { path }),
  skipRebase: (path: string) => invoke<void>("cmd_skip_rebase", { path }),
  previewRebaseTodo: (path: string, from: string, onto: string) =>
    invoke<TodoEntry[]>("cmd_preview_rebase_todo", { path, from, onto }),
  startInteractiveRebase: (path: string, onto: string, upstream: string, todo: TodoEntry[]) =>
    invoke<void>("cmd_start_interactive_rebase", { path, onto, upstream, todo }),
  repoState: (path: string) => invoke<RepoState>("cmd_repo_state", { path }),
  listRemotes: (path: string) => invoke<RemoteInfo[]>("cmd_list_remotes", { path }),
  addRemote: (path: string, name: string, url: string) =>
    invoke<void>("cmd_add_remote", { path, name, url }),
  removeRemote: (path: string, name: string) => invoke<void>("cmd_remove_remote", { path, name }),
  renameRemote: (path: string, oldName: string, newName: string) =>
    invoke<void>("cmd_rename_remote", { path, oldName, newName }),
  setRemoteUrl: (path: string, name: string, url: string, push = false) =>
    invoke<void>("cmd_set_remote_url", { path, name, url, push }),
  reset: (path: string, target: string, mode: ResetMode) =>
    invoke<void>("cmd_reset", { path, target, mode }),
  createTag: (
    path: string,
    name: string,
    message: string | null,
    target: string | null,
    force: boolean,
  ) => invoke<void>("cmd_create_tag", { path, name, message, target, force }),
  deleteTag: (path: string, name: string) => invoke<void>("cmd_delete_tag", { path, name }),
  pushTag: (path: string, remote: string, name: string, deleteRemote: boolean) =>
    invoke<void>("cmd_push_tag", { path, remote, name, delete: deleteRemote }),
  commitLog: (
    path: string,
    limit = 200,
    skip = 0,
    query: string | null = null,
    allBranches = false,
  ) => invoke<CommitSummary[]>("cmd_commit_log", { path, limit, skip, query, allBranches }),
  fileHistory: (path: string, file: string, limit = 500, skip = 0) =>
    invoke<CommitSummary[]>("cmd_file_history", { path, file, limit, skip }),
  blame: (path: string, file: string, rev: string | null = null) =>
    invoke<BlameLine[]>("cmd_blame", { path, file, rev }),
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
  listConflicts: (path: string) => invoke<ConflictEntry[]>("cmd_list_conflicts", { path }),
  conflictSides: (path: string, file: string) =>
    invoke<ConflictSides>("cmd_conflict_sides", { path, file }),
  resolveWith: (path: string, file: string, side: ResolveSide) =>
    invoke<void>("cmd_resolve_with", { path, file, side }),
  resolveWithContent: (path: string, file: string, content: string) =>
    invoke<void>("cmd_resolve_with_content", { path, file, content }),
  markResolved: (path: string, files: string[]) =>
    invoke<void>("cmd_mark_resolved", { path, files }),
  unmarkConflict: (path: string, files: string[]) =>
    invoke<void>("cmd_unmark_conflict", { path, files }),
  remoteAuthors: (path: string) => invoke<RemoteAuthor[]>("cmd_remote_authors", { path }),
  listProviderTokens: () => invoke<ProviderToken[]>("cmd_list_provider_tokens"),
  setProviderToken: (host: string, token: string) =>
    invoke<void>("cmd_set_provider_token", { host, token }),
  clearProviderToken: (host: string) => invoke<void>("cmd_clear_provider_token", { host }),
};
