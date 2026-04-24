import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { type GraphRow, laneColor, layoutGraph } from "@/lib/commit-graph";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommitLog } from "../hooks/use-commit-log";
import { AuthorAvatar } from "./author-avatar";

type Props = { repoPath: string };

const ROW_HEIGHT = 56;
const LANE_WIDTH = 14;
const DOT_RADIUS = 4;
const GRAPH_PAD_LEFT = 8;
const GRAPH_PAD_RIGHT = 6;

export function CommitList({ repoPath }: Props) {
  const { data, isLoading, error } = useCommitLog(repoPath);
  const parentRef = useRef<HTMLDivElement>(null);
  const selectedCommitId = useSelectionStore((s) => s.selectedCommitId);
  const selectCommit = useSelectionStore((s) => s.selectCommit);

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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {["a", "b", "c", "d", "e", "f"].map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Failed to load commits: {(error as Error).message}
      </div>
    );
  }

  if (rows.length === 0) {
    return <div className="p-4 text-sm text-muted-foreground">No commits yet.</div>;
  }

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
        {virtualizer.getVirtualItems().map((v) => {
          const c = rows[v.index];
          const g = graph.rows[v.index];
          const isSelected = c.id === selectedCommitId;
          return (
            <button
              key={c.id}
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
          );
        })}
      </div>
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
