import { AlertTriangle, Eye } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { FileIcon } from "@/components/file-icon";
import { ErrorState, LoadingState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import type { StatusEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection, type WorkingSide } from "@/stores/selection-store";
import { useStatus, useWorkingDiff } from "../hooks/use-status";
import { DiffViewer } from "./diff-viewer";
import { FileTree, TreeIndentGuides, TreeLeafSpacer } from "./file-tree";

export function ChangesView({ repoPath }: { repoPath: string }) {
  const statusQuery = useStatus(repoPath);
  const status = statusQuery.data;
  const { workingSide, workingFilePath } = useTabSelection(repoPath);
  const selectInStore = useSelectionStore((state) => state.selectWorkingFile);
  const selectFile = useCallback(
    (side: WorkingSide, path: string | null) => selectInStore(repoPath, side, path),
    [repoPath, selectInStore],
  );

  const groups = useMemo(
    () => [
      { title: "Conflicted", side: "unstaged" as const, entries: status?.conflicted ?? [] },
      { title: "Staged", side: "staged" as const, entries: status?.staged ?? [] },
      { title: "Changed", side: "unstaged" as const, entries: status?.unstaged ?? [] },
      { title: "Untracked", side: "unstaged" as const, entries: status?.untracked ?? [] },
    ],
    [status],
  );
  const allEntries = useMemo(
    () => groups.flatMap((group) => group.entries.map((entry) => ({ ...group, entry }))),
    [groups],
  );

  useEffect(() => {
    if (!status) return;
    const selectionExists = allEntries.some(
      ({ entry, side }) => entry.path === workingFilePath && side === workingSide,
    );
    if (!selectionExists) {
      const first = allEntries[0];
      selectFile(first?.side ?? "unstaged", first?.entry.path ?? null);
    }
  }, [status, allEntries, workingFilePath, workingSide, selectFile]);

  const isClean = status && allEntries.length === 0;

  return (
    <ResizablePanelGroup id="etch:changes:readonly" orientation="horizontal" className="h-full">
      <ResizablePanel id="etch:changes-files" defaultSize="28%" minSize="18%" maxSize="60%">
        <aside className="flex h-full flex-col overflow-hidden border-r">
          <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Working tree
            </span>
            <Badge variant="outline" className="gap-1 font-normal">
              <Eye /> Read only
            </Badge>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {statusQuery.isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {["a", "b", "c", "d"].map((key) => (
                  <Skeleton key={key} className="h-6 w-full" />
                ))}
              </div>
            ) : statusQuery.error ? (
              <ErrorState
                error={statusQuery.error as Error}
                title="Couldn't read working tree"
                onRetry={() => void statusQuery.refetch()}
                tone="compact"
              />
            ) : isClean ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyTitle className="text-sm">Working tree clean</EmptyTitle>
                  <EmptyDescription>There are no uncommitted changes.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              groups.map((group) => (
                <StatusGroup
                  key={group.title}
                  repoPath={repoPath}
                  title={group.title}
                  entries={group.entries}
                  danger={group.title === "Conflicted"}
                  selectedSide={workingSide}
                  selectedPath={workingFilePath}
                  side={group.side}
                  onSelect={selectFile}
                />
              ))
            )}
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel id="etch:changes-diff" defaultSize="72%" minSize="30%">
        <section className="h-full min-w-0">
          {workingFilePath ? (
            <WorkingDiff
              repoPath={repoPath}
              filePath={workingFilePath}
              staged={workingSide === "staged"}
            />
          ) : (
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyDescription>Select a file to inspect its diff.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </section>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function StatusGroup({
  repoPath,
  title,
  entries,
  danger,
  selectedSide,
  selectedPath,
  side,
  onSelect,
}: {
  repoPath: string;
  title: string;
  entries: StatusEntry[];
  danger: boolean;
  selectedSide: WorkingSide;
  selectedPath: string | null;
  side: WorkingSide;
  onSelect: (side: WorkingSide, path: string | null) => void;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={cn("border-b", danger && "border-destructive/40 bg-destructive/5")}>
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold tracking-wider uppercase",
          danger ? "bg-destructive/10 text-destructive" : "bg-muted/40 text-muted-foreground",
        )}
      >
        {danger && <AlertTriangle />}
        {title} ({entries.length})
      </div>
      <FileTree
        items={entries}
        persistKey={`${repoPath}:readonly:${title}`}
        renderItem={(entry, { depth, displayName, indentPx }) => (
          <button
            key={`${title}:${entry.path}`}
            type="button"
            onClick={() => onSelect(side, entry.path)}
            data-selected={selectedSide === side && selectedPath === entry.path ? true : undefined}
            className="group flex w-full min-w-0 items-stretch text-left text-[13px] hover:bg-muted/60 data-[selected]:bg-primary/10"
          >
            <TreeIndentGuides depth={depth} indentPx={indentPx} />
            <span className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-3">
              <TreeLeafSpacer />
              <FileIcon path={entry.path} />
              <span className="min-w-0 flex-1 truncate">{displayName}</span>
              <StatusBadge code={entry.code} conflict={danger} />
            </span>
          </button>
        )}
      />
    </div>
  );
}

function WorkingDiff({
  repoPath,
  filePath,
  staged,
}: {
  repoPath: string;
  filePath: string;
  staged: boolean;
}) {
  const query = useWorkingDiff(repoPath, filePath, staged);
  if (query.isLoading) return <LoadingState label="Loading diff…" />;
  if (query.error)
    return <ErrorState error={query.error as Error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <DiffViewer data={query.data} />;
}

function StatusBadge({ code, conflict }: { code: string; conflict: boolean }) {
  const value = code.trim();
  const letter = conflict
    ? "!"
    : value === "??"
      ? "U"
      : value.includes("A")
        ? "A"
        : value.includes("D")
          ? "D"
          : value.includes("R")
            ? "R"
            : "M";
  return (
    <span
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded font-mono text-[10px] font-bold",
        conflict
          ? "bg-destructive/15 text-destructive"
          : "bg-muted-foreground/15 text-muted-foreground",
      )}
      title={conflict ? "Conflicted" : value}
    >
      {letter}
    </span>
  );
}
