import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { ErrorState, LoadingState } from "@/components/states";
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
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { CommitSummary, ReflogEntry, ResetMode } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useCheckout } from "../hooks/use-branch-mutations";
import { useReflog } from "../hooks/use-reflog";
import { CreateBranchDialog } from "./create-branch-dialog";
import { ResetConfirmDialog } from "./reset-confirm-dialog";

type Props = { repoPath: string };

const ROW_HEIGHT = 48;

export function ReflogView({ repoPath }: Props) {
  const { data, isLoading, error, hasNextPage, isFetchingNextPage, fetchNextPage, refetch } =
    useReflog(repoPath);
  const checkout = useCheckout(repoPath);
  const parentRef = useRef<HTMLDivElement>(null);
  const [resetTarget, setResetTarget] = useState<{ commit: CommitSummary; mode: ResetMode } | null>(
    null,
  );
  const [branchFromOid, setBranchFromOid] = useState<string | null>(null);

  const rows = useMemo(() => data ?? [], [data]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 16,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (rows.length === 0) return;
    if (lastVisibleIndex >= rows.length - 32) {
      void fetchNextPage();
    }
  }, [lastVisibleIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) return <LoadingState label="Loading reflog…" />;
  if (error) return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  if (rows.length === 0) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle className="text-sm">No reflog entries</EmptyTitle>
          <EmptyDescription>
            HEAD has no recorded movements yet. Most repos populate this on first commit.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-background/95 px-3 py-2 text-xs text-muted-foreground">
        <span>
          HEAD reflog · {rows.length} {rows.length === 1 ? "entry" : "entries"}
        </span>
        <span className="text-[10px] uppercase tracking-wider">
          Right-click an entry to recover
        </span>
      </div>
      <div ref={parentRef} className="min-h-0 flex-1 overflow-auto">
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
          {virtualItems.map((vi) => {
            const entry = rows[vi.index];
            return (
              <div
                key={entry.refSelector}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  transform: `translateY(${vi.start}px)`,
                  height: `${ROW_HEIGHT}px`,
                }}
              >
                <ReflogRow
                  entry={entry}
                  onReset={(mode) => setResetTarget({ commit: toCommit(entry), mode })}
                  onCreateBranch={() => setBranchFromOid(entry.oid)}
                  onCheckoutDetached={() => checkout.mutate({ target: entry.oid, create: false })}
                />
              </div>
            );
          })}
        </div>
      </div>

      <ResetConfirmDialog
        repoPath={repoPath}
        open={resetTarget !== null}
        onOpenChange={(o) => !o && setResetTarget(null)}
        commit={resetTarget?.commit ?? null}
        mode={resetTarget?.mode ?? "mixed"}
      />
      <CreateBranchDialog
        repoPath={repoPath}
        open={branchFromOid !== null}
        onOpenChange={(o) => !o && setBranchFromOid(null)}
        startPoint={branchFromOid}
      />
    </div>
  );
}

// The selector form (`HEAD@{N}`) is not a stable revision after subsequent
// reflog writes shift indices, so always recover via the resolved oid.
function toCommit(entry: ReflogEntry): CommitSummary {
  return {
    id: entry.oid,
    shortId: entry.oid.slice(0, 7),
    summary: entry.subject,
    authorName: entry.authorName,
    authorEmail: entry.authorEmail,
    timestamp: entry.timestamp,
    committerName: entry.authorName,
    committerEmail: entry.authorEmail,
    committerTimestamp: entry.timestamp,
    parentIds: [],
  };
}

function ReflogRow({
  entry,
  onReset,
  onCreateBranch,
  onCheckoutDetached,
}: {
  entry: ReflogEntry;
  onReset: (mode: ResetMode) => void;
  onCreateBranch: () => void;
  onCheckoutDetached: () => void;
}) {
  const when = entry.timestamp
    ? formatDistanceToNow(new Date(entry.timestamp * 1000), { addSuffix: true })
    : "";
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "flex h-full select-none items-center gap-3 border-b px-3 text-[13px]",
            "hover:bg-muted/60",
          )}
        >
          <code className="w-[70px] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
            {entry.oid.slice(0, 7)}
          </code>
          <span className="w-[110px] shrink-0 truncate font-mono text-[11px] text-muted-foreground">
            {entry.refSelector}
          </span>
          <span className="w-[80px] shrink-0 truncate rounded bg-muted px-1.5 py-0.5 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {entry.action || "—"}
          </span>
          <span className="min-w-0 flex-1 truncate text-foreground" title={entry.subject}>
            {entry.subject}
          </span>
          <span className="shrink-0 text-[11px] text-muted-foreground">{when}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={onCreateBranch}>Create branch from this…</ContextMenuItem>
        <ContextMenuItem onSelect={onCheckoutDetached}>Checkout (detached)</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Reset current branch to this</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem onSelect={() => onReset("soft")}>Soft</ContextMenuItem>
            <ContextMenuItem onSelect={() => onReset("mixed")}>Mixed</ContextMenuItem>
            <ContextMenuItem variant="destructive" onSelect={() => onReset("hard")}>
              Hard
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>
  );
}
