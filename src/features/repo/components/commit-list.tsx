import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Copy, Pencil, Search, X } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsDark } from "@/hooks/use-is-dark";
import { type GraphRow, layoutGraph } from "@/lib/commit-graph";
import { laneColor } from "@/lib/lane-colors";
import type { CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useCommitLog } from "../hooks/use-commit-log";
import { useStatus } from "../hooks/use-status";
import { AuthorAvatar } from "./author-avatar";

const ROW_HEIGHT = 56;
const LANE_WIDTH = 14;
const DOT_RADIUS = 4.5;
const STROKE_WIDTH = 1.75;
const GRAPH_PAD_LEFT = 8;
const GRAPH_PAD_RIGHT = 6;
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

export function CommitList({
  repoPath,
  headCommitId,
}: {
  repoPath: string;
  headCommitId: string | null;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const allBranches = useUiStore((state) => state.commitLogAllBranches);
  const setAllBranches = useUiStore((state) => state.setCommitLogAllBranches);
  const { data: status } = useStatus(repoPath);
  const { selectedCommitId } = useTabSelection(repoPath);
  const selectCommitInStore = useSelectionStore((state) => state.selectCommit);
  const setView = useSelectionStore((state) => state.setView);
  const selectCommit = useCallback(
    (commit: CommitSummary) => selectCommitInStore(repoPath, commit.id, commit),
    [repoPath, selectCommitInStore],
  );

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 200);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const log = useCommitLog(repoPath, debouncedQuery, allBranches);
  const rows = log.data ?? [];
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    measureElement: (element) => element.getBoundingClientRect().height,
  });
  const graph = useMemo(
    () => layoutGraph(rows.map((row) => ({ id: row.id, parentIds: row.parentIds }))),
    [rows],
  );
  const graphWidth = GRAPH_PAD_LEFT + Math.max(1, graph.width) * LANE_WIDTH + GRAPH_PAD_RIGHT;
  const isDark = useIsDark();

  const dirtyCount =
    (status?.staged.length ?? 0) +
    (status?.unstaged.length ?? 0) +
    (status?.untracked.length ?? 0) +
    (status?.conflicted.length ?? 0);

  useEffect(() => {
    if (rows.length === 0) return;
    if (selectedCommitId && rows.some((commit) => commit.id === selectedCommitId)) return;
    const initial = rows.find((commit) => commit.id === headCommitId) ?? rows[0];
    selectCommit(initial);
  }, [rows, selectedCommitId, headCommitId, selectCommit]);

  useEffect(() => {
    if (!selectedCommitId) return;
    const index = rows.findIndex((commit) => commit.id === selectedCommitId);
    if (index >= 0) virtualizer.scrollToIndex(index, { align: "auto" });
  }, [selectedCommitId, rows, virtualizer]);

  const virtualItems = virtualizer.getVirtualItems();
  const lastVisible = virtualItems[virtualItems.length - 1]?.index ?? 0;
  useEffect(() => {
    if (log.hasNextPage && !log.isFetchingNextPage && lastVisible >= rows.length - 24) {
      void log.fetchNextPage();
    }
  }, [lastVisible, rows.length, log]);

  useEffect(() => {
    if (rows.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.matches("input, textarea, select") || target.isContentEditable)
      ) {
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      const current = selectedCommitId
        ? rows.findIndex((commit) => commit.id === selectedCommitId)
        : -1;
      let next = current;
      if (event.key === "ArrowDown") next = Math.min(rows.length - 1, current + 1);
      if (event.key === "ArrowUp") next = Math.max(0, current - 1);
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = rows.length - 1;
      if (next === current || next < 0) return;
      event.preventDefault();
      selectCommit(rows[next]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, selectedCommitId, selectCommit]);

  const toolbar = (
    <div className="flex items-center gap-2 border-b bg-background/95 p-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={allBranches ? "all" : "current"}
        onValueChange={(value) => {
          if (value) setAllBranches(value === "all");
        }}
      >
        <ToggleGroupItem value="current" className="h-7 px-2.5 text-xs">
          Current
        </ToggleGroupItem>
        <ToggleGroupItem value="all" className="h-7 px-2.5 text-xs">
          All history
        </ToggleGroupItem>
      </ToggleGroup>
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search message, author, or email"
          className="h-7 pr-7 pl-7 text-xs"
        />
        {query && (
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-1/2 right-1 h-5 w-5 -translate-y-1/2"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X />
          </Button>
        )}
      </div>
      {debouncedQuery && (
        <span className="text-xs text-muted-foreground">
          {log.isFetching && !log.isFetchingNextPage
            ? "Searching…"
            : `${rows.length}${log.hasNextPage ? "+" : ""} matches`}
        </span>
      )}
    </div>
  );

  const workingTreeRow = dirtyCount > 0 && (
    <button
      type="button"
      onClick={() => setView(repoPath, "changes")}
      className="flex min-h-14 w-full items-center gap-3 border-b px-3 text-left hover:bg-muted/40"
    >
      <span className="flex h-7 w-7 items-center justify-center rounded-full border border-dashed text-muted-foreground">
        <Pencil className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm italic">Uncommitted changes</div>
        <div className="text-xs text-muted-foreground">
          {dirtyCount} file{dirtyCount === 1 ? "" : "s"}
        </div>
      </div>
      {(status?.conflicted.length ?? 0) > 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle />
          {status?.conflicted.length} conflicted
        </Badge>
      )}
    </button>
  );

  if (log.isLoading && rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        {workingTreeRow}
        {SKELETON_KEYS.map((key) => (
          <div key={key} className="flex items-center gap-3 border-b p-3">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-7 w-7 rounded-full" />
            <Skeleton className="h-8 flex-1" />
          </div>
        ))}
      </div>
    );
  }

  if (log.error) {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        {workingTreeRow}
        <ErrorState
          error={log.error as Error}
          title="Failed to load commits"
          onRetry={() => void log.refetch()}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {toolbar}
        {workingTreeRow}
        <div className="p-4 text-sm text-muted-foreground">
          {debouncedQuery ? `No commits match “${debouncedQuery}”.` : "No commits yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {toolbar}
      {workingTreeRow}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualItems.map((item) => {
            const commit = rows[item.index];
            const graphRow = graph.rows[item.index];
            return (
              <div
                key={commit.id}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${item.start}px)`,
                }}
              >
                <button
                  type="button"
                  onClick={() => selectCommit(commit)}
                  className={cn(
                    "group flex min-h-14 w-full items-center gap-3 border-b border-border/50 pr-2 text-left",
                    selectedCommitId === commit.id ? "bg-primary/10" : "hover:bg-muted/40",
                  )}
                >
                  <GraphCell row={graphRow} width={graphWidth} isDark={isDark} />
                  <AuthorAvatar name={commit.authorName} email={commit.authorEmail} size={28} />
                  <code className="w-[4.5rem] shrink-0 text-xs text-muted-foreground">
                    {commit.shortId}
                  </code>
                  <div className="min-w-0 flex-1 py-1.5">
                    <div className="truncate text-sm">{commit.summary}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {commit.authorName} ·{" "}
                      {formatDistanceToNow(new Date(commit.timestamp * 1000), { addSuffix: true })}
                    </div>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          void navigator.clipboard
                            .writeText(commit.id)
                            .then(() => toast.success("Commit SHA copied", { duration: 1200 }));
                        }}
                        aria-label="Copy commit SHA"
                      >
                        <Copy />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy commit SHA</TooltipContent>
                  </Tooltip>
                </button>
              </div>
            );
          })}
        </div>
        {log.isFetchingNextPage && (
          <div className="p-2 text-center text-xs text-muted-foreground">Loading more…</div>
        )}
      </div>
    </div>
  );
}

const GraphCell = memo(function GraphCell({
  row,
  width,
  isDark,
}: {
  row: GraphRow;
  width: number;
  isDark: boolean;
}) {
  const mid = ROW_HEIGHT / 2;
  const laneX = (index: number) => GRAPH_PAD_LEFT + index * LANE_WIDTH + LANE_WIDTH / 2;
  const top: React.ReactElement[] = [];
  const bottom: React.ReactElement[] = [];

  for (let index = 0; index < row.incomingLanes.length; index++) {
    if (!row.incomingLanes[index]) continue;
    top.push(
      <line
        key={`top-${index}`}
        x1={laneX(index)}
        y1={0}
        x2={laneX(index)}
        y2={mid}
        stroke={laneColor(row.incomingColors[index], isDark)}
        strokeWidth={STROKE_WIDTH}
      />,
    );
  }

  const parentLanes = new Set(row.parentLanes);
  for (let index = 0; index < row.outgoingLanes.length; index++) {
    if (!row.outgoingLanes[index]) continue;
    const x = laneX(index);
    const color = laneColor(row.outgoingColors[index], isDark);
    if (parentLanes.has(index)) {
      bottom.push(
        <path
          key={`bottom-${index}`}
          d={`M ${laneX(row.lane)} ${mid} C ${laneX(row.lane)} ${mid + 12}, ${x} ${mid + 12}, ${x} ${ROW_HEIGHT}`}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />,
      );
    } else {
      bottom.push(
        <line
          key={`bottom-${index}`}
          x1={x}
          y1={mid}
          x2={x}
          y2={ROW_HEIGHT}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
        />,
      );
    }
  }

  return (
    <svg width={width} height={ROW_HEIGHT} className="shrink-0" aria-hidden="true">
      {top}
      {bottom}
      <circle
        cx={laneX(row.lane)}
        cy={mid}
        r={DOT_RADIUS}
        fill={laneColor(row.color, isDark)}
        stroke="var(--background)"
        strokeWidth={2}
      />
    </svg>
  );
});
