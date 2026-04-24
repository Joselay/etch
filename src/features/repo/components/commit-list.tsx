import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommitLog } from "../hooks/use-commit-log";

type Props = { repoPath: string };

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
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
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
          const isSelected = c.id === selectedCommitId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => selectCommit(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/50 px-4 text-left",
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
