import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { AlertTriangle, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { type GraphRow, laneColor, layoutGraph } from "@/lib/commit-graph";
import type { CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCherryPick, useReset, useRevert } from "../hooks/use-branch-mutations";
import { useCommitLog } from "../hooks/use-commit-log";
import { AuthorAvatar } from "./author-avatar";
import { ResetHardConfirmDialog } from "./reset-confirm-dialog";

type Props = { repoPath: string };

const ROW_HEIGHT = 56;
const LANE_WIDTH = 14;
const DOT_RADIUS = 4;
const GRAPH_PAD_LEFT = 8;
const GRAPH_PAD_RIGHT = 6;

export function CommitList({ repoPath }: Props) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery), 200);
    return () => window.clearTimeout(t);
  }, [rawQuery]);

  const { data, isLoading, error, isFetching } = useCommitLog(repoPath, debouncedQuery);
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCommitId = useSelectionStore((s) => s.selectedCommitId);
  const selectCommit = useSelectionStore((s) => s.selectCommit);
  const revert = useRevert(repoPath);
  const cherryPick = useCherryPick(repoPath);
  const reset = useReset(repoPath);
  const [hardResetTarget, setHardResetTarget] = useState<CommitSummary | null>(null);

  useEffect(() => {
    if (!selectedCommitId && data && data.length > 0) {
      selectCommit(data[0].id);
    }
  }, [data, selectedCommitId, selectCommit]);

  const rows = data ?? [];

  const graph = useMemo(
    () => layoutGraph(rows.map((r) => ({ id: r.id, parentIds: r.parentIds }))),
    [rows],
  );
  const graphWidth = GRAPH_PAD_LEFT + Math.max(1, graph.width) * LANE_WIDTH + GRAPH_PAD_RIGHT;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });

  const searchBar = (
    <div className="flex items-center gap-2 border-b bg-background/95 p-2">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={rawQuery}
          onChange={(e) => setRawQuery(e.target.value)}
          placeholder="Search message, author, or email"
          className="h-7 pl-7 pr-7 text-xs"
        />
        {rawQuery && (
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setRawQuery("")}
            aria-label="Clear search"
            className="-translate-y-1/2 absolute top-1/2 right-1 h-5 w-5"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      {debouncedQuery && (
        <span className="text-xs text-muted-foreground">
          {isFetching ? "Searching…" : `${rows.length} match${rows.length === 1 ? "" : "es"}`}
        </span>
      )}
    </div>
  );

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        <div className="flex flex-1 flex-col gap-2 p-4">
          {["a", "b", "c", "d", "e", "f"].map((k) => (
            <Skeleton key={k} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        <div className="p-4 text-destructive text-sm">
          Failed to load commits: {(error as Error).message}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        <div className="p-4 text-muted-foreground text-sm">
          {debouncedQuery ? `No commits match “${debouncedQuery}”.` : "No commits yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {searchBar}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualizer.getVirtualItems().map((v) => {
            const c = rows[v.index];
            const g = graph.rows[v.index];
            const isSelected = c.id === selectedCommitId;
            return (
              <ContextMenu key={c.id}>
                <ContextMenuTrigger asChild>
                  <button
                    type="button"
                    onClick={() => selectCommit(c.id)}
                    className={cn(
                      "flex w-full items-center gap-3 border-b border-border/50 pr-4 text-left",
                      isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      height: v.size,
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    <GraphCell row={g} height={v.size} width={graphWidth} />
                    <AuthorAvatar name={c.authorName} email={c.authorEmail} size={28} />
                    <code className="w-[4.5rem] shrink-0 font-mono text-xs text-muted-foreground">
                      {c.shortId}
                    </code>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.summary}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.authorName} ·{" "}
                        {formatDistanceToNow(new Date(c.timestamp * 1000), { addSuffix: true })}
                      </div>
                    </div>
                  </button>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem onSelect={() => cherryPick.mutate(c.id)}>
                    Cherry-pick onto current
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={() => revert.mutate({ commit: c.id })}>
                    Revert this commit
                  </ContextMenuItem>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>Reset current branch here</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      <ContextMenuItem
                        onSelect={() => reset.mutate({ target: c.id, mode: "soft" })}
                      >
                        Soft (keep index + worktree)
                      </ContextMenuItem>
                      <ContextMenuItem
                        onSelect={() => reset.mutate({ target: c.id, mode: "mixed" })}
                      >
                        Mixed (keep worktree only)
                      </ContextMenuItem>
                      <ContextMenuItem variant="destructive" onSelect={() => setHardResetTarget(c)}>
                        <AlertTriangle />
                        Hard (discard everything)
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={() => {
                      void navigator.clipboard.writeText(c.id);
                    }}
                  >
                    Copy commit SHA
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            );
          })}
        </div>
      </div>
      <ResetHardConfirmDialog
        repoPath={repoPath}
        commit={hardResetTarget}
        open={hardResetTarget !== null}
        onOpenChange={(o) => !o && setHardResetTarget(null)}
      />
    </div>
  );
}

function GraphCell({ row, height, width }: { row: GraphRow; height: number; width: number }) {
  const mid = height / 2;
  const laneX = (i: number) => GRAPH_PAD_LEFT + i * LANE_WIDTH + LANE_WIDTH / 2;

  const topSegments: React.ReactElement[] = [];
  const bottomSegments: React.ReactElement[] = [];

  for (let i = 0; i < row.incomingLanes.length; i++) {
    if (!row.incomingLanes[i]) continue;
    const x = laneX(i);
    topSegments.push(
      <line
        key={`t-${i}`}
        x1={x}
        y1={0}
        x2={x}
        y2={mid}
        stroke={laneColor(row.incomingColors[i])}
        strokeWidth={1.5}
        opacity={i === row.lane ? 1 : 0.75}
      />,
    );
  }

  // Outgoing (bottom half).
  const parentLaneSet = new Set(row.parentLanes);
  for (let i = 0; i < row.outgoingLanes.length; i++) {
    if (!row.outgoingLanes[i]) continue;
    const x = laneX(i);
    const color = laneColor(row.outgoingColors[i]);
    const isParentEdge = parentLaneSet.has(i);
    if (isParentEdge) {
      const from = { x: laneX(row.lane), y: mid };
      const to = { x, y: height };
      const c1y = mid + (height - mid) * 0.55;
      const path = `M ${from.x} ${from.y} C ${from.x} ${c1y}, ${to.x} ${c1y}, ${to.x} ${to.y}`;
      bottomSegments.push(
        <path key={`b-${i}`} d={path} stroke={color} strokeWidth={1.5} fill="none" />,
      );
    } else {
      bottomSegments.push(
        <line
          key={`b-${i}`}
          x1={x}
          y1={mid}
          x2={x}
          y2={height}
          stroke={color}
          strokeWidth={1.5}
          opacity={0.75}
        />,
      );
    }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      {topSegments}
      {bottomSegments}
      <circle
        cx={laneX(row.lane)}
        cy={mid}
        r={DOT_RADIUS}
        fill={laneColor(row.color)}
        stroke="var(--background)"
        strokeWidth={2}
      />
    </svg>
  );
}
