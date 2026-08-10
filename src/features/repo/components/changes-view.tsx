import { AlertTriangle, Lock, RotateCcw, Trash2, Users } from "lucide-react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileIcon } from "@/components/file-icon";
import { ErrorState, LoadingState } from "@/components/states";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { ItemGroup } from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { buildHunkPatch, buildPartialDiscardPatch, buildPartialHunkPatch } from "@/lib/patch";
import type { ConflictEntry, ConflictKind, FileDiff, StatusEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useCommitMessage } from "../hooks/use-commit-details";
import { useConflictActions, useConflicts } from "../hooks/use-conflicts";
import { useCrlfConfig } from "../hooks/use-git-config";
import { useRefs } from "../hooks/use-refs";
import {
  useCommit,
  useCommitTemplate,
  useSigningConfig,
  useStageActions,
  useStatus,
  useWorkingDiff,
} from "../hooks/use-status";
import { DiffViewer, type HunkAction, type LineAction } from "./diff-viewer";
import { FileRowContextMenu } from "./file-row-context-menu";
import { FileTree, TreeIndentGuides, TreeLeafSpacer } from "./file-tree";

type Props = { repoPath: string };

const ConflictViewer = lazy(() =>
  import("./conflict-viewer").then((module) => ({ default: module.ConflictViewer })),
);

export function ChangesView({ repoPath }: Props) {
  const { data: status, isLoading } = useStatus(repoPath);
  const { data: conflicts } = useConflicts(repoPath);
  const { stage, unstage, discard, discardMixed, applyPatch } = useStageActions(repoPath);
  const conflictActions = useConflictActions(repoPath);
  const commit = useCommit(repoPath);
  const { data: signing } = useSigningConfig(repoPath);
  const { data: template } = useCommitTemplate(repoPath);
  const { data: crlf } = useCrlfConfig(repoPath);
  const { workingSide, workingFilePath } = useTabSelection(repoPath);
  const selectWorkingFileFn = useSelectionStore((s) => s.selectWorkingFile);
  const selectWorkingFile = useCallback(
    (side: "staged" | "unstaged", file: string | null) => selectWorkingFileFn(repoPath, side, file),
    [selectWorkingFileFn, repoPath],
  );

  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [signOff, setSignOff] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);
  const [deleteUntrackedTarget, setDeleteUntrackedTarget] = useState<string | null>(null);
  const [multiSelected, setMultiSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [selectionAnchor, setSelectionAnchor] = useState<string | null>(null);
  const [discardAllOpen, setDiscardAllOpen] = useState(false);
  const templateAppliedRef = useRef(false);
  const messageBeforeAmendRef = useRef<string | null>(null);
  const messageRef = useRef(message);
  messageRef.current = message;
  const { data: refs } = useRefs(repoPath);
  const headCommitId = refs?.headCommitId ?? null;
  const { data: headMessage } = useCommitMessage(
    amend ? repoPath : null,
    amend ? headCommitId : null,
  );

  // Pre-fill from commit.template once per empty-message session, until the
  // user types something. Cleared on commit so it can re-apply later.
  useEffect(() => {
    if (templateAppliedRef.current) return;
    if (amend) return;
    if (messageRef.current.trim().length > 0) return;
    if (template) {
      setMessage(template);
      templateAppliedRef.current = true;
    }
  }, [template, amend]);

  // Pre-fill on amend; restore the prior draft when toggled off. We capture
  // the user's draft once on toggle so they don't lose it.
  useEffect(() => {
    if (amend) {
      if (messageBeforeAmendRef.current === null) {
        messageBeforeAmendRef.current = messageRef.current;
      }
      if (headMessage !== undefined && messageRef.current === messageBeforeAmendRef.current) {
        setMessage(headMessage ?? "");
      }
    } else if (messageBeforeAmendRef.current !== null) {
      setMessage(messageBeforeAmendRef.current);
      messageBeforeAmendRef.current = null;
    }
  }, [amend, headMessage]);

  const staged = status?.staged ?? [];
  const unstaged = status?.unstaged ?? [];
  const untracked = status?.untracked ?? [];

  const untrackedEntries = useMemo<StatusEntry[]>(
    () => untracked.map((u) => ({ path: u.path, oldPath: null, code: "??" })),
    [untracked],
  );

  useEffect(() => {
    if (!status || workingFilePath) return;
    if (staged.length > 0) selectWorkingFile("staged", staged[0].path);
    else if (unstaged.length > 0) selectWorkingFile("unstaged", unstaged[0].path);
    else if (untrackedEntries.length > 0) selectWorkingFile("unstaged", untrackedEntries[0].path);
  }, [status, workingFilePath, staged, unstaged, untrackedEntries, selectWorkingFile]);

  // Drop multi-selected paths that no longer exist (e.g. after a discard or
  // external file change). Selection covers both unstaged and untracked.
  useEffect(() => {
    setMultiSelected((prev) => {
      if (prev.size === 0) return prev;
      const valid = new Set<string>();
      for (const u of unstaged) valid.add(u.path);
      for (const u of untracked) valid.add(u.path);
      let changed = false;
      const next = new Set<string>();
      for (const p of prev) {
        if (valid.has(p)) next.add(p);
        else changed = true;
      }
      return changed ? next : prev;
    });
    setSelectionAnchor((prev) => {
      if (!prev) return prev;
      const stillValid =
        unstaged.some((u) => u.path === prev) || untracked.some((u) => u.path === prev);
      return stillValid ? prev : null;
    });
  }, [unstaged, untracked]);

  // Display order for shift-click range selection. Matches buildFileTree's
  // alphabetical sort within each group; unstaged comes before untracked.
  const orderedSelectablePaths = useMemo(() => {
    const u = unstaged.map((x) => x.path).sort((a, b) => a.localeCompare(b));
    const n = untracked.map((x) => x.path).sort((a, b) => a.localeCompare(b));
    return [...u, ...n];
  }, [unstaged, untracked]);

  // Split the multi-selection into tracked vs untracked, each in display order,
  // for the discard confirmation dialog.
  const discardSummary = useMemo(() => {
    const untrackedSet = new Set(untracked.map((u) => u.path));
    const tracked: string[] = [];
    const untrackedPaths: string[] = [];
    for (const p of orderedSelectablePaths) {
      if (!multiSelected.has(p)) continue;
      if (untrackedSet.has(p)) untrackedPaths.push(p);
      else tracked.push(p);
    }
    return { tracked, untracked: untrackedPaths };
  }, [multiSelected, orderedSelectablePaths, untracked]);

  const handleRowMouseSelect = useCallback(
    (path: string, e: React.MouseEvent) => {
      // The currently focused file acts as an implicit anchor / first-pick when
      // the user starts modifier-clicking without an explicit one — a plain
      // click that focused a file should count as the first item in the
      // selection so the next Cmd/Shift+click extends from there.
      const implicitAnchor =
        workingSide === "unstaged" &&
        workingFilePath &&
        orderedSelectablePaths.includes(workingFilePath)
          ? workingFilePath
          : null;
      const anchor = selectionAnchor ?? implicitAnchor;

      // Shift+click: extend selection from the anchor to this row.
      if (e.shiftKey && anchor && anchor !== path) {
        const i = orderedSelectablePaths.indexOf(anchor);
        const j = orderedSelectablePaths.indexOf(path);
        if (i >= 0 && j >= 0) {
          const [lo, hi] = i <= j ? [i, j] : [j, i];
          const range = orderedSelectablePaths.slice(lo, hi + 1);
          setMultiSelected((prev) => {
            const next = new Set(prev);
            for (const p of range) next.add(p);
            return next;
          });
          setSelectionAnchor(anchor);
          selectWorkingFile("unstaged", path);
          return;
        }
      }
      // Cmd/Ctrl+click (or shift+click with no anchor): toggle this one and
      // seed the focused file into the selection if nothing was selected yet.
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        setSelectionAnchor(path);
        setMultiSelected((prev) => {
          const next = new Set(prev);
          if (next.size === 0 && implicitAnchor && implicitAnchor !== path) {
            next.add(implicitAnchor);
          }
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        selectWorkingFile("unstaged", path);
        return;
      }
      // Plain click: clear multi-selection, set anchor + focused file.
      setSelectionAnchor(path);
      if (multiSelected.size > 0) setMultiSelected(new Set());
      selectWorkingFile("unstaged", path);
    },
    [
      multiSelected,
      orderedSelectablePaths,
      selectionAnchor,
      selectWorkingFile,
      workingFilePath,
      workingSide,
    ],
  );

  // Cmd/Ctrl+A selects every changed/untracked file; Cmd/Ctrl+Shift+D discards
  // them. Scoped to the changes view because this component only mounts there.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable)
          return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "a" && !e.shiftKey) {
        // Always swallow — falling through to the browser's native select-all
        // would highlight UI text, which is never what the user wants here.
        e.preventDefault();
        const next = new Set<string>();
        for (const u of unstaged) next.add(u.path);
        for (const u of untracked) next.add(u.path);
        setMultiSelected(next);
      } else if (key === "d" && e.shiftKey) {
        if (multiSelected.size > 0) {
          e.preventDefault();
          setDiscardAllOpen(true);
          return;
        }
        // Fall back to the currently focused file when nothing is multi-selected
        // — single-click + Cmd+Shift+D should still discard that one file.
        if (workingSide === "unstaged" && workingFilePath) {
          const inUnstaged = unstaged.some((u) => u.path === workingFilePath);
          const inUntracked = untracked.some((u) => u.path === workingFilePath);
          if (inUnstaged) {
            e.preventDefault();
            setDiscardTarget(workingFilePath);
          } else if (inUntracked) {
            e.preventDefault();
            setMultiSelected(new Set([workingFilePath]));
            setDiscardAllOpen(true);
          }
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [unstaged, untracked, multiSelected, workingSide, workingFilePath]);

  // Clear multi-selection on any click (inside or outside the file list) and
  // on Escape. Row clicks already clear-and-reselect via their own onSelect,
  // so the net effect there is unchanged. Skip while the confirm dialog is
  // open so clicks inside it don't wipe the selection before discard fires.
  useEffect(() => {
    if (multiSelected.size === 0) return;
    if (discardAllOpen || discardTarget) return;
    const onMouseDown = (e: MouseEvent) => {
      // Don't clear when the user is building up a selection via modifier-click.
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      setMultiSelected(new Set());
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMultiSelected(new Set());
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [multiSelected, discardAllOpen, discardTarget]);

  const conflictList = conflicts ?? [];
  const nothingToShow =
    !isLoading &&
    staged.length === 0 &&
    unstaged.length === 0 &&
    untracked.length === 0 &&
    conflictList.length === 0;

  const canCommit = !commit.isPending && message.trim().length > 0 && (amend || staged.length > 0);
  const runCommit = () => {
    if (!canCommit) return;
    commit.mutate(
      { message: message.trim(), amend, signOff },
      {
        onSuccess: () => {
          setMessage("");
          setAmend(false);
          templateAppliedRef.current = false;
        },
      },
    );
  };

  const addCoAuthor = () => {
    const name = window.prompt("Co-author name");
    if (!name) return;
    const email = window.prompt("Co-author email");
    if (!email) return;
    const trailer = `Co-authored-by: ${name.trim()} <${email.trim()}>`;
    setMessage((prev) => {
      const trimmed = prev.replace(/\s+$/, "");
      if (!trimmed) return trailer;
      const sep = trimmed.endsWith("\n") ? "" : "\n\n";
      return `${trimmed}${sep}${trailer}`;
    });
  };

  return (
    <ResizablePanelGroup id="etch:changes-inner:v1" orientation="horizontal" className="h-full">
      <ResizablePanel id="etch:changes-files" defaultSize="28%" minSize="18%" maxSize="60%">
        <aside className="flex h-full flex-col overflow-hidden border-r">
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {["a", "b", "c", "d"].map((k) => (
                  <Skeleton key={k} className="h-6 w-full" />
                ))}
              </div>
            ) : nothingToShow ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">Working tree clean</EmptyTitle>
                  <EmptyDescription>Nothing to commit.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col">
                <Group
                  title="Conflicts"
                  count={conflictList.length}
                  tone="danger"
                  icon={<AlertTriangle className="h-3.5 w-3.5" />}
                >
                  {conflictList.map((c) => (
                    <ConflictRow
                      key={`c-${c.path}`}
                      repoPath={repoPath}
                      entry={c}
                      selected={workingSide === "unstaged" && workingFilePath === c.path}
                      onSelect={() => selectWorkingFile("unstaged", c.path)}
                      pending={
                        conflictActions.resolveWith.isPending ||
                        conflictActions.markResolved.isPending
                      }
                      onUseOurs={() =>
                        conflictActions.resolveWith.mutate({ file: c.path, side: "ours" })
                      }
                      onUseTheirs={() =>
                        conflictActions.resolveWith.mutate({ file: c.path, side: "theirs" })
                      }
                      onMarkResolved={() => conflictActions.markResolved.mutate([c.path])}
                    />
                  ))}
                </Group>

                <Group
                  title="Staged"
                  count={staged.length}
                  action={
                    staged.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={unstage.isPending}
                        onClick={() => unstage.mutate(staged.map((s) => s.path))}
                      >
                        Unstage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={staged}
                    persistKey={`${repoPath}:changes:staged`}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`s-${f.path}`}
                        repoPath={repoPath}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "staged" && workingFilePath === f.path}
                        onSelect={() => selectWorkingFile("staged", f.path)}
                        actionLabel="Unstage"
                        actionDisabled={unstage.isPending}
                        onAction={() => unstage.mutate([f.path])}
                      />
                    )}
                  />
                </Group>

                <Group
                  title="Changed"
                  count={unstaged.length}
                  action={
                    unstaged.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={stage.isPending}
                        onClick={() => stage.mutate(unstaged.map((u) => u.path))}
                      >
                        Stage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={unstaged}
                    persistKey={`${repoPath}:changes:unstaged`}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`u-${f.path}`}
                        repoPath={repoPath}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "unstaged" && workingFilePath === f.path}
                        multiSelected={multiSelected.has(f.path)}
                        onSelect={(e) => handleRowMouseSelect(f.path, e)}
                        actionLabel="Stage"
                        actionDisabled={stage.isPending}
                        onAction={() => stage.mutate([f.path])}
                        secondary={
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                                disabled={discard.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDiscardTarget(f.path);
                                }}
                                aria-label="Discard changes"
                              >
                                <RotateCcw className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Discard changes</TooltipContent>
                          </Tooltip>
                        }
                      />
                    )}
                  />
                </Group>

                <Group
                  title="Untracked"
                  count={untracked.length}
                  action={
                    untracked.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        disabled={stage.isPending}
                        onClick={() => stage.mutate(untracked.map((u) => u.path))}
                      >
                        Stage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={untrackedEntries}
                    persistKey={`${repoPath}:changes:untracked`}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`n-${f.path}`}
                        repoPath={repoPath}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "unstaged" && workingFilePath === f.path}
                        multiSelected={multiSelected.has(f.path)}
                        onSelect={(e) => handleRowMouseSelect(f.path, e)}
                        actionLabel="Stage"
                        actionDisabled={stage.isPending}
                        onAction={() => stage.mutate([f.path])}
                        secondary={
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                                disabled={discardMixed.isPending}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteUntrackedTarget(f.path);
                                }}
                                aria-label="Delete file"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete file</TooltipContent>
                          </Tooltip>
                        }
                      />
                    )}
                  />
                </Group>
              </div>
            )}
          </div>

          {crlf && !crlf.autocrlf && !crlf.eol && staged.length > 0 && (
            <div className="flex items-start gap-2 border-t bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>
                Line endings are not normalized (<code>core.autocrlf</code> and{" "}
                <code>core.eol</code> are unset). Mixed CRLF/LF can cause noisy diffs across
                platforms.
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t p-3">
            <Label htmlFor="commit-message" className="sr-only">
              Commit message
            </Label>
            <Textarea
              id="commit-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  if (canCommit) runCommit();
                }
              }}
              placeholder={amend ? "Amend commit message… (⌘⏎)" : "Commit message (⌘⏎ to commit)"}
              className="min-h-[80px] resize-none text-sm"
            />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <Field orientation="horizontal">
                <Checkbox
                  id="amend"
                  checked={amend}
                  onCheckedChange={(v) => setAmend(v === true)}
                />
                <FieldLabel htmlFor="amend" className="text-xs text-muted-foreground">
                  Amend last commit
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="signoff"
                  checked={signOff}
                  onCheckedChange={(v) => setSignOff(v === true)}
                />
                <FieldLabel htmlFor="signoff" className="text-xs text-muted-foreground">
                  Sign-off
                </FieldLabel>
              </Field>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 gap-1 px-1.5 text-xs text-muted-foreground"
                onClick={addCoAuthor}
              >
                <Users className="h-3 w-3" />
                Add co-author
              </Button>
              {signing?.enabled && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lock className="h-3 w-3" />
                      {signing.format === "ssh" ? "SSH" : "GPG"} signing
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Commits will be signed
                    {signing.key ? ` with ${signing.key.slice(0, 16)}…` : ""}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Button size="sm" disabled={!canCommit} onClick={runCommit}>
              {commit.isPending ? "Committing…" : amend ? "Amend" : "Commit"}
            </Button>
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="etch:changes-diff" defaultSize="72%" minSize="30%">
        <section className="h-full min-w-0">
          {workingFilePath ? (
            (() => {
              const conflict = conflictList.find((c) => c.path === workingFilePath);
              if (conflict) {
                return (
                  <Suspense
                    fallback={
                      <div className="p-4 text-xs text-muted-foreground">
                        Loading conflict editor…
                      </div>
                    }
                  >
                    <ConflictViewer repoPath={repoPath} entry={conflict} />
                  </Suspense>
                );
              }
              return (
                <WorkingDiffPane
                  repoPath={repoPath}
                  filePath={workingFilePath}
                  staged={workingSide === "staged"}
                  onApplyPatch={(vars) => applyPatch.mutate(vars)}
                  applyPatchPending={applyPatch.isPending}
                />
              );
            })()
          ) : (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyDescription>Select a file to see its changes.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </ResizablePanel>

      <AlertDialog open={discardAllOpen} onOpenChange={setDiscardAllOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Discard {multiSelected.size} file{multiSelected.size === 1 ? "" : "s"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {discardSummary.untracked.length > 0 && discardSummary.tracked.length > 0
                ? "Tracked changes will be reverted; untracked files will be permanently deleted."
                : discardSummary.untracked.length > 0
                  ? "Untracked files will be permanently deleted from disk."
                  : "All changes to the selected files will be lost and cannot be recovered."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {multiSelected.size > 0 && (
            <div className="max-h-[40vh] space-y-2 overflow-auto">
              {discardSummary.tracked.length > 0 && (
                <DiscardFileList title="Changed" paths={discardSummary.tracked} />
              )}
              {discardSummary.untracked.length > 0 && (
                <DiscardFileList
                  title="Untracked (will be deleted)"
                  tone="danger"
                  paths={discardSummary.untracked}
                />
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discardMixed.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={discardMixed.isPending}
              onClick={(e) => {
                e.preventDefault();
                const { tracked, untracked: untrackedPaths } = discardSummary;
                if (tracked.length === 0 && untrackedPaths.length === 0) {
                  setDiscardAllOpen(false);
                  return;
                }
                discardMixed.mutate(
                  { tracked, untracked: untrackedPaths },
                  {
                    onSuccess: () => {
                      setMultiSelected(new Set());
                      setDiscardAllOpen(false);
                    },
                  },
                );
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes to <span className="font-mono text-foreground">{discardTarget}</span> will be
              lost and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {discardTarget && (
            <div className="max-h-[50vh] overflow-hidden rounded-md border">
              <DiscardPreview repoPath={repoPath} filePath={discardTarget} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discard.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={discard.isPending}
              onClick={() => {
                if (discardTarget) discard.mutate([discardTarget]);
                setDiscardTarget(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteUntrackedTarget}
        onOpenChange={(o) => !o && setDeleteUntrackedTarget(null)}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete file?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono text-foreground">{deleteUntrackedTarget}</span> is
              untracked and will be permanently deleted from disk. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={discardMixed.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={discardMixed.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!deleteUntrackedTarget) return;
                discardMixed.mutate(
                  { tracked: [], untracked: [deleteUntrackedTarget] },
                  { onSuccess: () => setDeleteUntrackedTarget(null) },
                );
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ResizablePanelGroup>
  );
}

function DiscardFileList({
  title,
  paths,
  tone = "default",
}: {
  title: string;
  paths: ReadonlyArray<string>;
  tone?: "default" | "danger";
}) {
  return (
    <div className="rounded-md border bg-muted/30">
      <div
        className={cn(
          "flex items-center justify-between border-b px-2 py-1 text-[11px] font-semibold uppercase tracking-wider",
          tone === "danger" ? "text-destructive" : "text-muted-foreground",
        )}
      >
        <span>{title}</span>
        <span className="tabular-nums">{paths.length}</span>
      </div>
      <ul className="p-1">
        {paths.map((p) => (
          <li key={p} className="flex min-w-0 items-center gap-1.5 px-2 py-1 font-mono text-xs">
            <FileIcon path={p} />
            <span className="min-w-0 flex-1 truncate">{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Group({
  title,
  count,
  action,
  children,
  tone = "default",
  icon,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  tone?: "default" | "danger";
  icon?: React.ReactNode;
}) {
  if (count === 0) return null;
  const isDanger = tone === "danger";
  return (
    <div
      className={cn(
        "border-b last:border-b-0",
        isDanger && "border-destructive/40 bg-destructive/5",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider",
          isDanger
            ? "border-b border-destructive/30 bg-destructive/10 text-destructive"
            : "bg-muted/40 text-muted-foreground",
        )}
      >
        <span className="inline-flex items-center gap-1.5">
          {icon}
          {title} ({count})
        </span>
        {action}
      </div>
      <ItemGroup>{children}</ItemGroup>
    </div>
  );
}

function FileRow({
  repoPath,
  entry,
  displayName,
  depth,
  indentPx,
  selected,
  multiSelected,
  onSelect,
  actionLabel,
  actionDisabled,
  onAction,
  secondary,
}: {
  repoPath: string;
  entry: StatusEntry;
  displayName: string;
  depth: number;
  indentPx: number;
  selected: boolean;
  multiSelected?: boolean;
  onSelect: (e: React.MouseEvent) => void;
  actionLabel: string;
  actionDisabled?: boolean;
  onAction: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <FileRowContextMenu repoPath={repoPath} relPath={entry.path}>
      <button
        type="button"
        onClick={(e) => onSelect(e)}
        data-selected={selected || undefined}
        data-multiselected={multiSelected || undefined}
        className={cn(
          "group flex w-full min-w-0 cursor-pointer items-stretch text-left text-[13px]",
          "hover:bg-muted/60",
          "data-[selected]:bg-primary/10 data-[selected]:text-foreground",
          "data-[multiselected]:bg-primary/10 data-[multiselected]:text-foreground",
        )}
      >
        <TreeIndentGuides depth={depth} indentPx={indentPx} />
        <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2">
          <TreeLeafSpacer />
          <FileIcon path={entry.path} />
          <span className="min-w-0 flex-1 truncate">{displayName}</span>
          <StatusBadge code={entry.code} />
          <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[selected]:opacity-100 group-focus-within:opacity-100">
            {secondary}
            <Button
              asChild
              size="sm"
              variant="ghost"
              className={cn("h-6 px-2 text-xs", actionDisabled && "pointer-events-none opacity-50")}
              aria-disabled={actionDisabled || undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (actionDisabled) return;
                onAction();
              }}
            >
              <span>{actionLabel}</span>
            </Button>
          </span>
        </div>
      </button>
    </FileRowContextMenu>
  );
}

const conflictKindLabel: Record<ConflictKind, string> = {
  bothModified: "both modified",
  bothAdded: "both added",
  bothDeleted: "both deleted",
  deletedByUs: "deleted by us",
  deletedByThem: "deleted by them",
  addedByUs: "added by us",
  addedByThem: "added by them",
  unknown: "conflict",
};

function ConflictRow({
  repoPath,
  entry,
  selected,
  onSelect,
  pending,
  onUseOurs,
  onUseTheirs,
  onMarkResolved,
}: {
  repoPath: string;
  entry: ConflictEntry;
  selected: boolean;
  onSelect: () => void;
  pending: boolean;
  onUseOurs: () => void;
  onUseTheirs: () => void;
  onMarkResolved: () => void;
}) {
  return (
    <FileRowContextMenu repoPath={repoPath} relPath={entry.path}>
      <button
        type="button"
        onClick={onSelect}
        data-selected={selected || undefined}
        className={cn(
          "group flex w-full min-w-0 cursor-pointer items-stretch text-left text-[13px]",
          "hover:bg-muted/60",
          "data-[selected]:bg-primary/10 data-[selected]:text-foreground",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2 pl-2">
          <FileIcon path={entry.path} />
          <span className="min-w-0 flex-1 truncate">{entry.path}</span>
          <span className="shrink-0 rounded bg-destructive/15 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-destructive">
            {conflictKindLabel[entry.kind]}
          </span>
          <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 group-data-[selected]:opacity-100 group-focus-within:opacity-100">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                onUseOurs();
              }}
            >
              Use ours
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                onUseTheirs();
              }}
            >
              Use theirs
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs"
              disabled={pending}
              onClick={(e) => {
                e.stopPropagation();
                onMarkResolved();
              }}
              title="Stage as-is"
            >
              Mark resolved
            </Button>
          </span>
        </div>
      </button>
    </FileRowContextMenu>
  );
}

function StatusBadge({ code }: { code: string }) {
  const c = code.trim();
  let letter = "M";
  let label = "Modified";
  let tone = "bg-muted-foreground/15 text-muted-foreground";
  if (c === "??") {
    letter = "U";
    label = "Untracked";
    tone = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  } else if (c.includes("A")) {
    letter = "A";
    label = "Added";
    tone = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  } else if (c.includes("D")) {
    letter = "D";
    label = "Deleted";
    tone = "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  } else if (c.includes("R")) {
    letter = "R";
    label = "Renamed";
    tone = "bg-sky-500/15 text-sky-600 dark:text-sky-400";
  } else if (c.includes("M")) {
    tone = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  }
  return (
    <span
      className={cn(
        "ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
        tone,
      )}
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{letter}</span>
    </span>
  );
}

function WorkingDiffPane({
  repoPath: _repoPath,
  filePath,
  staged,
  onApplyPatch,
  applyPatchPending,
}: {
  repoPath: string;
  filePath: string;
  staged: boolean;
  onApplyPatch: (vars: { patch: string; cached: boolean; reverse: boolean; toast: string }) => void;
  applyPatchPending: boolean;
}) {
  const { data, isLoading, error, refetch } = useWorkingDiff(_repoPath, filePath, staged);
  const [pendingDiscardHunk, setPendingDiscardHunk] = useState<number | null>(null);
  const [pendingDiscardLines, setPendingDiscardLines] = useState<ReadonlyArray<{
    hunkIdx: number;
    lineIdx: number;
  }> | null>(null);

  if (isLoading) return <LoadingState label="Loading diff…" />;
  if (error) return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  if (!data) return null;

  const hunkActions = buildHunkActions(data, staged, onApplyPatch, applyPatchPending, (hi) =>
    setPendingDiscardHunk(hi),
  );
  const lineActions = buildLineActions(data, staged, onApplyPatch, applyPatchPending, (lines) =>
    setPendingDiscardLines(lines),
  );

  const discardLinesHunkIdx = pendingDiscardLines?.[0]?.hunkIdx ?? null;

  return (
    <>
      <DiffViewer data={data} hunkActions={hunkActions} lineActions={lineActions} />
      <AlertDialog
        open={pendingDiscardHunk !== null}
        onOpenChange={(o) => !o && setPendingDiscardHunk(null)}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard this hunk?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes in this hunk of <span className="font-mono text-foreground">{filePath}</span>{" "}
              will be lost and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingDiscardHunk !== null && (
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <DiffViewer data={{ ...data, hunks: [data.hunks[pendingDiscardHunk]] }} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyPatchPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={applyPatchPending}
              onClick={() => {
                if (pendingDiscardHunk === null) return;
                try {
                  const patch = buildHunkPatch(data, pendingDiscardHunk);
                  onApplyPatch({
                    patch,
                    cached: false,
                    reverse: true,
                    toast: "Discarded hunk",
                  });
                } finally {
                  setPendingDiscardHunk(null);
                }
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={pendingDiscardLines !== null}
        onOpenChange={(o) => !o && setPendingDiscardLines(null)}
      >
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard selected lines?</AlertDialogTitle>
            <AlertDialogDescription>
              The selected line changes in{" "}
              <span className="font-mono text-foreground">{filePath}</span> will be lost and cannot
              be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {discardLinesHunkIdx !== null && data.hunks[discardLinesHunkIdx] && (
            <div className="max-h-[50vh] overflow-auto rounded-md border">
              <DiffViewer data={{ ...data, hunks: [data.hunks[discardLinesHunkIdx]] }} />
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={applyPatchPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={applyPatchPending}
              onClick={() => {
                if (!pendingDiscardLines || pendingDiscardLines.length === 0) return;
                const hunkIdx = pendingDiscardLines[0].hunkIdx;
                const selected = new Set(pendingDiscardLines.map((l) => l.lineIdx));
                try {
                  const patch = buildPartialDiscardPatch(data, hunkIdx, selected);
                  if (patch) {
                    // Reverse semantics are baked into the patch (pre-image
                    // = current WT, post-image = WT with selected reverted),
                    // so apply forward, not reverse.
                    onApplyPatch({
                      patch,
                      cached: false,
                      reverse: false,
                      toast: "Discarded lines",
                    });
                  }
                } finally {
                  setPendingDiscardLines(null);
                }
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DiscardPreview({ repoPath, filePath }: { repoPath: string; filePath: string }) {
  const { data, isLoading, error, refetch } = useWorkingDiff(repoPath, filePath, false);
  if (isLoading) return <LoadingState label="Loading preview…" tone="compact" />;
  if (error)
    return <ErrorState error={error as Error} onRetry={() => void refetch()} tone="compact" />;
  if (!data) return <div className="p-3 text-xs text-muted-foreground">No preview available.</div>;
  return (
    <div className="h-full overflow-auto">
      <DiffViewer data={data} />
    </div>
  );
}

function buildHunkActions(
  diff: FileDiff,
  staged: boolean,
  onApplyPatch: (vars: { patch: string; cached: boolean; reverse: boolean; toast: string }) => void,
  pending: boolean,
  requestDiscard: (hunkIndex: number) => void,
): HunkAction[] | undefined {
  // No hunk-level ops for binary or empty diffs.
  if (diff.isBinary || diff.hunks.length === 0) return undefined;

  const apply = (hunkIndex: number, cached: boolean, reverse: boolean, label: string) => {
    let patch: string;
    try {
      patch = buildHunkPatch(diff, hunkIndex);
    } catch {
      return;
    }
    onApplyPatch({ patch, cached, reverse, toast: label });
  };

  if (staged) {
    return [
      {
        label: "Unstage hunk",
        disabled: pending,
        onClick: (hi) => apply(hi, true, true, "Unstaged hunk"),
      },
    ];
  }
  return [
    {
      label: "Stage hunk",
      disabled: pending,
      onClick: (hi) => apply(hi, true, false, "Staged hunk"),
    },
    {
      label: "Discard hunk",
      destructive: true,
      disabled: pending,
      onClick: (hi) => requestDiscard(hi),
    },
  ];
}

function buildLineActions(
  diff: FileDiff,
  staged: boolean,
  onApplyPatch: (vars: { patch: string; cached: boolean; reverse: boolean; toast: string }) => void,
  pending: boolean,
  requestDiscardLines: (lines: ReadonlyArray<{ hunkIdx: number; lineIdx: number }>) => void,
): LineAction[] | undefined {
  if (diff.isBinary || diff.hunks.length === 0) return undefined;

  const apply = (
    lines: ReadonlyArray<{ hunkIdx: number; lineIdx: number }>,
    reverse: boolean,
    toast: string,
  ) => {
    if (lines.length === 0) return;
    // The DiffViewer keeps every selection within a single hunk so we don't
    // need to renumber subsequent hunks. Defensive guard in case that ever
    // changes.
    const hunkIdx = lines[0].hunkIdx;
    if (lines.some((l) => l.hunkIdx !== hunkIdx)) return;
    const selected = new Set(lines.map((l) => l.lineIdx));
    const patch = buildPartialHunkPatch(diff, hunkIdx, selected);
    if (!patch) return;
    onApplyPatch({ patch, cached: true, reverse, toast });
  };

  if (staged) {
    return [
      {
        label: "Unstage lines",
        disabled: pending,
        onClick: (lines) => apply(lines, true, "Unstaged lines"),
      },
    ];
  }
  return [
    {
      label: "Stage lines",
      disabled: pending,
      onClick: (lines) => apply(lines, false, "Staged lines"),
    },
    {
      label: "Discard lines",
      destructive: true,
      disabled: pending,
      onClick: (lines) => {
        if (lines.length === 0) return;
        const hunkIdx = lines[0].hunkIdx;
        if (lines.some((l) => l.hunkIdx !== hunkIdx)) return;
        requestDiscardLines(lines);
      },
    },
  ];
}
