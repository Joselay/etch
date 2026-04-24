import { Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { FileIcon } from "@/components/file-icon";
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
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StatusEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommit, useStageActions, useStatus, useWorkingDiff } from "../hooks/use-status";
import { DiffViewer } from "./diff-viewer";
import { FileTree, TreeIndentGuides, TreeLeafSpacer } from "./file-tree";

type Props = { repoPath: string };

export function ChangesView({ repoPath }: Props) {
  const { data: status, isLoading } = useStatus(repoPath);
  const { stage, unstage, discard } = useStageActions(repoPath);
  const commit = useCommit(repoPath);
  const workingSide = useSelectionStore((s) => s.workingSide);
  const workingFilePath = useSelectionStore((s) => s.workingFilePath);
  const selectWorkingFile = useSelectionStore((s) => s.selectWorkingFile);

  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);

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

  const nothingToShow =
    !isLoading && staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

  return (
    <ResizablePanelGroup id="loom:changes-inner:v1" orientation="horizontal" className="h-full">
      <ResizablePanel id="loom:changes-files" defaultSize="28%" minSize="18%" maxSize="60%">
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
                  title="Staged"
                  count={staged.length}
                  action={
                    staged.length > 0 ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-2 text-xs"
                        onClick={() => unstage.mutate(staged.map((s) => s.path))}
                      >
                        Unstage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={staged}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`s-${f.path}`}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "staged" && workingFilePath === f.path}
                        onSelect={() => selectWorkingFile("staged", f.path)}
                        actionLabel="Unstage"
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
                        onClick={() => stage.mutate(unstaged.map((u) => u.path))}
                      >
                        Stage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={unstaged}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`u-${f.path}`}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "unstaged" && workingFilePath === f.path}
                        onSelect={() => selectWorkingFile("unstaged", f.path)}
                        actionLabel="Stage"
                        onAction={() => stage.mutate([f.path])}
                        secondary={
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDiscardTarget(f.path);
                            }}
                            title="Discard changes"
                          >
                            <Undo2 className="h-3 w-3" />
                          </Button>
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
                        onClick={() => stage.mutate(untracked.map((u) => u.path))}
                      >
                        Stage all
                      </Button>
                    ) : null
                  }
                >
                  <FileTree
                    items={untrackedEntries}
                    renderItem={(f, { depth, displayName, indentPx }) => (
                      <FileRow
                        key={`n-${f.path}`}
                        entry={f}
                        displayName={displayName}
                        depth={depth}
                        indentPx={indentPx}
                        selected={workingSide === "unstaged" && workingFilePath === f.path}
                        onSelect={() => selectWorkingFile("unstaged", f.path)}
                        actionLabel="Stage"
                        onAction={() => stage.mutate([f.path])}
                      />
                    )}
                  />
                </Group>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t p-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={amend ? "Amend commit message…" : "Commit message"}
              className="min-h-[80px] resize-none text-sm"
            />
            <Field orientation="horizontal">
              <Checkbox id="amend" checked={amend} onCheckedChange={(v) => setAmend(v === true)} />
              <FieldLabel htmlFor="amend" className="text-xs text-muted-foreground">
                Amend last commit
              </FieldLabel>
            </Field>
            {commit.error && (
              <div className="text-xs text-destructive">{(commit.error as Error).message}</div>
            )}
            <Button
              size="sm"
              disabled={
                commit.isPending || message.trim().length === 0 || (!amend && staged.length === 0)
              }
              onClick={() =>
                commit.mutate(
                  { message: message.trim(), amend },
                  {
                    onSuccess: () => {
                      setMessage("");
                      setAmend(false);
                    },
                  },
                )
              }
            >
              {commit.isPending ? "Committing…" : amend ? "Amend" : "Commit"}
            </Button>
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="loom:changes-diff" defaultSize="72%" minSize="30%">
        <section className="h-full min-w-0">
          {workingFilePath ? (
            <WorkingDiffPane
              repoPath={repoPath}
              filePath={workingFilePath}
              staged={workingSide === "staged"}
            />
          ) : (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyDescription>Select a file to see its changes.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </ResizablePanel>

      <AlertDialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes to <span className="font-mono text-foreground">{discardTarget}</span> will be
              lost and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
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
    </ResizablePanelGroup>
  );
}

function Group({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {title} ({count})
        </span>
        {action}
      </div>
      <ItemGroup>{children}</ItemGroup>
    </div>
  );
}

function FileRow({
  entry,
  displayName,
  depth,
  indentPx,
  selected,
  onSelect,
  actionLabel,
  onAction,
  secondary,
}: {
  entry: StatusEntry;
  displayName: string;
  depth: number;
  indentPx: number;
  selected: boolean;
  onSelect: () => void;
  actionLabel: string;
  onAction: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected || undefined}
      className={cn(
        "group relative flex w-full min-w-0 cursor-pointer items-stretch text-left text-[13px]",
        "hover:bg-muted/60",
        "data-[selected]:bg-primary/10 data-[selected]:text-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-[2px]",
          selected ? "bg-primary" : "bg-transparent",
        )}
      />
      <TreeIndentGuides depth={depth} indentPx={indentPx} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-2">
        <TreeLeafSpacer />
        <FileIcon path={entry.path} />
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
        <StatusBadge code={entry.code} />
        <span className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {secondary}
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
          >
            <span>{actionLabel}</span>
          </Button>
        </span>
      </div>
    </button>
  );
}

function StatusBadge({ code }: { code: string }) {
  const c = code.trim();
  let letter = "M";
  let tone = "bg-muted-foreground/15 text-muted-foreground";
  if (c === "??") {
    letter = "U";
    tone = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  } else if (c.includes("A")) {
    letter = "A";
    tone = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  } else if (c.includes("D")) {
    letter = "D";
    tone = "bg-rose-500/15 text-rose-600 dark:text-rose-400";
  } else if (c.includes("R")) {
    letter = "R";
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
    >
      {letter}
    </span>
  );
}

function WorkingDiffPane({
  repoPath,
  filePath,
  staged,
}: {
  repoPath: string;
  filePath: string;
  staged: boolean;
}) {
  const { data, isLoading, error } = useWorkingDiff(repoPath, filePath, staged);
  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading diff…</div>;
  if (error) return <div className="p-4 text-xs text-destructive">{(error as Error).message}</div>;
  if (!data) return null;
  return <DiffViewer data={data} />;
}
