import { useVirtualizer } from "@tanstack/react-virtual";
import { formatDistanceToNow } from "date-fns";
import {
  AlertTriangle,
  ArrowUp,
  Check,
  Filter,
  GitCommitVertical,
  Pencil,
  RotateCcw,
  Search,
  X,
} from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ErrorState } from "@/components/states";
import { Badge } from "@/components/ui/badge";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsDark } from "@/hooks/use-is-dark";
import { type GraphRow, layoutGraph } from "@/lib/commit-graph";
import { laneColor } from "@/lib/lane-colors";
import type { BranchRef, CommitSummary, ResetMode, TagRef } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useCherryPick, useRevert } from "../hooks/use-branch-mutations";
import { useCommitLog } from "../hooks/use-commit-log";
import { useRefs } from "../hooks/use-refs";
import { useStatus } from "../hooks/use-status";
import { AuthorAvatar } from "./author-avatar";
import { BisectStartDialog } from "./bisect-start-dialog";
import { ResetConfirmDialog } from "./reset-confirm-dialog";

type Props = { repoPath: string };

const ROW_HEIGHT = 56;
const LANE_WIDTH = 14;
const DOT_RADIUS = 4.5;
const STROKE_WIDTH = 1.75;
const GRAPH_PAD_LEFT = 8;
const GRAPH_PAD_RIGHT = 6;
const SKELETON_KEYS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;

export function CommitList({ repoPath }: Props) {
  const [rawQuery, setRawQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [debouncedPath, setDebouncedPath] = useState("");
  const [pickaxe, setPickaxe] = useState("");
  const [debouncedPickaxe, setDebouncedPickaxe] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQuery(rawQuery), 200);
    return () => window.clearTimeout(t);
  }, [rawQuery]);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedPath(pathFilter), 300);
    return () => window.clearTimeout(t);
  }, [pathFilter]);
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedPickaxe(pickaxe), 300);
    return () => window.clearTimeout(t);
  }, [pickaxe]);

  const allBranches = useUiStore((s) => s.commitLogAllBranches);
  const setAllBranches = useUiStore((s) => s.setCommitLogAllBranches);
  const { data: refs } = useRefs(repoPath);
  const { data: status } = useStatus(repoPath);
  const refsByCommit = useMemo(() => buildRefsByCommit(refs), [refs]);
  const setView = useSelectionStore((s) => s.setView);
  const { selectedCommitId } = useTabSelection(repoPath);

  const dirtyCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);
  const conflictCount = status?.conflicted.length ?? 0;
  const hasWorkingTree = dirtyCount > 0 || conflictCount > 0;
  const {
    data,
    isLoading,
    error,
    isFetching,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    refetch,
  } = useCommitLog(repoPath, debouncedQuery, allBranches, debouncedPath, debouncedPickaxe);
  const parentRef = useRef<HTMLDivElement>(null);
  const selectCommitFn = useSelectionStore((s) => s.selectCommit);
  const selectCommit = useCallback(
    (id: string | null, summary?: CommitSummary | null) => selectCommitFn(repoPath, id, summary),
    [selectCommitFn, repoPath],
  );
  const revert = useRevert(repoPath);
  const cherryPick = useCherryPick(repoPath);
  const [resetTarget, setResetTarget] = useState<{ commit: CommitSummary; mode: ResetMode } | null>(
    null,
  );
  const [bisectFrom, setBisectFrom] = useState<string | null>(null);
  const requestReset = useCallback((commit: CommitSummary, mode: ResetMode) => {
    setResetTarget({ commit, mode });
  }, []);

  // Follow HEAD: when the active branch's commit id changes (checkout, pull,
  // commit), select and scroll to it so the list highlights where you are.
  // We wait until the new log includes that commit before acting.
  const headCommitId = refs?.headCommitId ?? null;
  const prevHeadRef = useRef<string | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: virtualizer instance is intentionally excluded — it is recreated each render but its methods operate on the stable parentRef.
  useEffect(() => {
    if (!headCommitId || !data) return;
    if (prevHeadRef.current === headCommitId) return;
    const idx = data.findIndex((c) => c.id === headCommitId);
    if (idx === -1) return;
    prevHeadRef.current = headCommitId;
    selectCommit(headCommitId, data[idx]);
    virtualizer.scrollToIndex(idx, { align: "start" });
  }, [headCommitId, data, selectCommit]);

  // Fallback: ensure something is selected once the log loads, and recover if
  // the previously selected commit disappears from the visible scope.
  useEffect(() => {
    if (!data || data.length === 0) return;
    if (selectedCommitId && data.some((c) => c.id === selectedCommitId)) return;
    selectCommit(data[0].id, data[0]);
  }, [data, selectedCommitId, selectCommit]);

  // Scroll the selected commit into view when selection changes from outside
  // the list (e.g. clicking a branch/tag in the sidebar). align:"auto" is a
  // no-op when the row is already visible, so it's safe on every change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: virtualizer is recreated each render but operates on the stable parentRef.
  useEffect(() => {
    if (!selectedCommitId || !data) return;
    const idx = data.findIndex((c) => c.id === selectedCommitId);
    if (idx === -1) return;
    virtualizer.scrollToIndex(idx, { align: "auto" });
  }, [selectedCommitId, data]);

  const rows = data ?? [];

  const graph = useMemo(
    () => layoutGraph(rows.map((r) => ({ id: r.id, parentIds: r.parentIds }))),
    [rows],
  );

  // A commit is "pushed" if it's reachable through parents from any remote
  // tracking ref. We BFS from every remote target through `parentIds` over the
  // currently loaded log. Commits whose ancestors haven't been paged in yet
  // may show as unpushed until the user scrolls — acceptable trade-off for an
  // O(N) frontend check with no backend round-trip.
  const pushedSet = useMemo(() => {
    const set = new Set<string>();
    if (!refs?.remote.length) return set;
    const byId = new Map<string, CommitSummary>();
    for (const r of rows) byId.set(r.id, r);
    const stack: string[] = [];
    for (const r of refs.remote) {
      if (r.target && byId.has(r.target)) stack.push(r.target);
    }
    while (stack.length > 0) {
      const id = stack.pop() as string;
      if (set.has(id)) continue;
      set.add(id);
      const c = byId.get(id);
      if (!c) continue;
      for (const p of c.parentIds) {
        if (!set.has(p) && byId.has(p)) stack.push(p);
      }
    }
    return set;
  }, [rows, refs?.remote]);
  const hasRemotes = (refs?.remote.length ?? 0) > 0;
  const graphWidth = GRAPH_PAD_LEFT + Math.max(1, graph.width) * LANE_WIDTH + GRAPH_PAD_RIGHT;
  const isDark = useIsDark();

  // HEAD's lane color — used to tint the pinned working-tree row so it reads
  // as "sitting on top of HEAD."
  const headIdxForColor = headCommitId ? rows.findIndex((c) => c.id === headCommitId) : -1;
  const headLaneColorIndex = headIdxForColor >= 0 ? (graph.rows[headIdxForColor]?.color ?? 0) : 0;
  const headLaneColor = laneColor(headLaneColorIndex, isDark);

  const workingTreeRow = hasWorkingTree ? (
    <WorkingTreeRow
      width={graphWidth}
      color={headLaneColor}
      dirtyCount={dirtyCount}
      conflictCount={conflictCount}
      onClick={() => setView(repoPath, "changes")}
    />
  ) : null;

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastVisibleIndex = virtualItems.length ? virtualItems[virtualItems.length - 1].index : 0;
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    if (rows.length === 0) return;
    if (lastVisibleIndex >= rows.length - 24) {
      void fetchNextPage();
    }
  }, [lastVisibleIndex, rows.length, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Arrow-key navigation through the commit list. Skips when the user is
  // typing in an input; otherwise fires globally so it works regardless of
  // which non-editable element happens to hold focus (tab trigger, resize
  // handle, sidebar item, etc.). WebKit doesn't focus buttons on click, so
  // gating on focus-in-list would miss the common case.
  useEffect(() => {
    if (rows.length === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable) {
          return;
        }
      }
      const key = e.key;
      if (key !== "ArrowDown" && key !== "ArrowUp" && key !== "Home" && key !== "End") return;
      const currentIdx = selectedCommitId ? rows.findIndex((r) => r.id === selectedCommitId) : -1;
      let nextIdx = currentIdx;
      if (key === "ArrowDown") nextIdx = Math.min(rows.length - 1, currentIdx + 1);
      else if (key === "ArrowUp") nextIdx = Math.max(0, currentIdx - 1);
      else if (key === "Home") nextIdx = 0;
      else if (key === "End") nextIdx = rows.length - 1;
      if (nextIdx === currentIdx || nextIdx < 0) return;
      e.preventDefault();
      selectCommit(rows[nextIdx].id, rows[nextIdx]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [rows, selectedCommitId, selectCommit]);

  const filterCount = (debouncedPath ? 1 : 0) + (debouncedPickaxe ? 1 : 0);
  const searchBar = (
    <div className="flex flex-col gap-2 border-b bg-background/95 p-2">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroup
              type="single"
              size="sm"
              variant="outline"
              value={allBranches ? "all" : "current"}
              onValueChange={(v) => {
                if (v === "all" || v === "current") setAllBranches(v === "all");
              }}
              className="h-7"
            >
              <ToggleGroupItem value="current" className="h-7 px-2.5 text-xs">
                Current
              </ToggleGroupItem>
              <ToggleGroupItem value="all" className="h-7 px-2.5 text-xs">
                All
              </ToggleGroupItem>
            </ToggleGroup>
          </TooltipTrigger>
          <TooltipContent>Toggle branch scope · ⌘⇧B</TooltipContent>
        </Tooltip>
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
        {(debouncedQuery || debouncedPath || debouncedPickaxe) && (
          <span className="text-xs text-muted-foreground">
            {isFetching && !isFetchingNextPage
              ? "Searching…"
              : `${rows.length}${hasNextPage ? "+" : ""} match${rows.length === 1 ? "" : "es"}`}
          </span>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              data-active={filterCount > 0 || advancedOpen || undefined}
              onClick={() => setAdvancedOpen((v) => !v)}
              aria-label="Toggle advanced filters"
            >
              <Filter className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {filterCount > 0
              ? `Filters active (${filterCount}). Click to ${advancedOpen ? "hide" : "show"}.`
              : "Filter by path or content"}
          </TooltipContent>
        </Tooltip>
      </div>
      {advancedOpen && (
        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1">
            <Input
              value={pathFilter}
              onChange={(e) => setPathFilter(e.target.value)}
              placeholder="Path filter (e.g. src/feature.ts)"
              className="h-7 pr-7 text-xs"
            />
            {pathFilter && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPathFilter("")}
                aria-label="Clear path filter"
                className="-translate-y-1/2 absolute top-1/2 right-1 h-5 w-5"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="relative flex-1">
            <Input
              value={pickaxe}
              onChange={(e) => setPickaxe(e.target.value)}
              placeholder="Pickaxe -S (find string in changes)"
              className="h-7 pr-7 text-xs"
            />
            {pickaxe && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPickaxe("")}
                aria-label="Clear pickaxe"
                className="-translate-y-1/2 absolute top-1/2 right-1 h-5 w-5"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (isLoading && rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        {workingTreeRow}
        <div className="flex flex-1 flex-col">
          {SKELETON_KEYS.map((k) => (
            <div
              key={k}
              className="flex items-center gap-3 border-b border-border/50 px-3 py-2"
              aria-hidden
            >
              <Skeleton className="h-3 w-3 shrink-0 rounded-full" />
              <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
              <Skeleton className="h-3 w-14 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <Skeleton className="h-3 w-3/5" />
                <Skeleton className="h-2.5 w-2/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        {workingTreeRow}
        <ErrorState
          error={error as Error}
          title="Failed to load commits"
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full flex-col">
        {searchBar}
        {workingTreeRow}
        <div className="p-4 text-muted-foreground text-sm">
          {debouncedQuery ? `No commits match “${debouncedQuery}”.` : "No commits yet."}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {searchBar}
      {workingTreeRow}
      <div ref={parentRef} className="flex-1 overflow-auto">
        <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}>
          {virtualItems.map((v) => {
            const c = rows[v.index];
            const g = graph.rows[v.index];
            const isSelected = c.id === selectedCommitId;
            return (
              <ContextMenu key={c.id}>
                <ContextMenuTrigger asChild>
                  <div
                    data-index={v.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${v.start}px)`,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectCommit(c.id, c)}
                      className={cn(
                        "group/row flex w-full items-center gap-3 border-b border-border/50 pr-2 text-left",
                        isSelected ? "bg-primary/10" : "hover:bg-muted/40",
                      )}
                      style={{ minHeight: ROW_HEIGHT }}
                    >
                      <GraphCell
                        row={g}
                        height={ROW_HEIGHT}
                        width={graphWidth}
                        isDark={isDark}
                        unpushed={hasRemotes && !pushedSet.has(c.id)}
                      />
                      <AuthorAvatar name={c.authorName} email={c.authorEmail} size={28} />
                      <span className="flex w-[4.5rem] shrink-0 items-center gap-1">
                        <code className="font-mono text-xs text-muted-foreground">{c.shortId}</code>
                        {hasRemotes && !pushedSet.has(c.id) && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="img"
                                aria-label="Local-only commit (not on any remote)"
                                className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-muted text-muted-foreground"
                              >
                                <ArrowUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>Local-only — not pushed</TooltipContent>
                          </Tooltip>
                        )}
                      </span>
                      <div className="min-w-0 flex-1 py-1.5">
                        <div className="truncate text-sm">{c.summary}</div>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                          <RefChips
                            entry={refsByCommit.get(c.id)}
                            laneColor={laneColor(g.color, isDark)}
                          />
                          <span className="truncate">
                            {c.authorName} ·{" "}
                            {formatDistanceToNow(new Date(c.timestamp * 1000), {
                              addSuffix: true,
                            })}
                          </span>
                        </div>
                      </div>
                      {/* biome-ignore lint/a11y/noStaticElementInteractions: container only swallows row-button click bubbling */}
                      <span
                        role="presentation"
                        className="ml-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={cherryPick.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                cherryPick.mutate(c.id);
                              }}
                              aria-label="Cherry-pick this commit"
                            >
                              <GitCommitVertical className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Cherry-pick</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              disabled={revert.isPending}
                              onClick={(e) => {
                                e.stopPropagation();
                                revert.mutate({ commit: c.id });
                              }}
                              aria-label="Revert this commit"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Revert</TooltipContent>
                        </Tooltip>
                      </span>
                    </button>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent>
                  <ContextMenuItem
                    disabled={cherryPick.isPending}
                    onSelect={() => cherryPick.mutate(c.id)}
                  >
                    <GitCommitVertical />
                    Cherry-pick onto current
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={revert.isPending}
                    onSelect={() => revert.mutate({ commit: c.id })}
                  >
                    <RotateCcw />
                    Revert this commit
                  </ContextMenuItem>
                  <ContextMenuSub>
                    <ContextMenuSubTrigger>Reset current branch here</ContextMenuSubTrigger>
                    <ContextMenuSubContent>
                      <ContextMenuItem onSelect={() => requestReset(c, "soft")}>
                        Soft (keep index + worktree)
                      </ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => requestReset(c, "mixed")}
                      >
                        Mixed (unstage but keep worktree)
                      </ContextMenuItem>
                      <ContextMenuItem
                        variant="destructive"
                        onSelect={() => requestReset(c, "hard")}
                      >
                        <AlertTriangle />
                        Hard (discard everything)
                      </ContextMenuItem>
                    </ContextMenuSubContent>
                  </ContextMenuSub>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={() => setBisectFrom(c.id)}>
                    Start bisect from here…
                  </ContextMenuItem>
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
        {isFetchingNextPage && (
          <div className="p-2 text-center text-muted-foreground text-xs">Loading more…</div>
        )}
      </div>
      <ResetConfirmDialog
        repoPath={repoPath}
        commit={resetTarget?.commit ?? null}
        mode={resetTarget?.mode ?? "hard"}
        open={resetTarget !== null}
        onOpenChange={(o) => !o && setResetTarget(null)}
      />
      <BisectStartDialog
        repoPath={repoPath}
        open={bisectFrom !== null}
        onOpenChange={(o) => !o && setBisectFrom(null)}
        badDefault={bisectFrom ?? undefined}
      />
    </div>
  );
}

type RefEntry = {
  detachedHead: boolean;
  locals: BranchRef[];
  remotes: BranchRef[];
  tags: TagRef[];
};

function buildRefsByCommit(
  refs: ReturnType<typeof useRefs>["data"] | undefined,
): Map<string, RefEntry> {
  const map = new Map<string, RefEntry>();
  if (!refs) return map;
  const get = (id: string): RefEntry => {
    let v = map.get(id);
    if (!v) {
      v = { detachedHead: false, locals: [], remotes: [], tags: [] };
      map.set(id, v);
    }
    return v;
  };
  for (const b of refs.local) if (b.target) get(b.target).locals.push(b);
  for (const b of refs.remote) if (b.target) get(b.target).remotes.push(b);
  for (const t of refs.tags) if (t.target) get(t.target).tags.push(t);
  if (refs.isDetached && refs.headCommitId) get(refs.headCommitId).detachedHead = true;
  return map;
}

const MAX_CHIPS = 4;

const RefChips = memo(function RefChips({
  entry,
  laneColor,
}: {
  entry: RefEntry | undefined;
  laneColor: string;
}) {
  if (!entry) return null;
  const items: React.ReactElement[] = [];
  const fullList: string[] = [];

  if (entry.detachedHead) {
    items.push(
      <span key="detached-head" className="text-[10px] italic">
        detached HEAD
      </span>,
    );
    fullList.push("detached HEAD");
  }

  // Merge local + same-named remote into one chip; remote-only branches render separately.
  const remotesByName = new Map<string, BranchRef[]>();
  for (const r of entry.remotes) {
    const list = remotesByName.get(r.name) ?? [];
    list.push(r);
    remotesByName.set(r.name, list);
  }
  const consumed = new Set<string>();

  for (const b of entry.locals) {
    const matched = remotesByName.get(b.name) ?? [];
    for (const m of matched) consumed.add(m.fullName);
    if (b.isHead) {
      items.push(
        <span
          key={`l:${b.fullName}`}
          className="inline-flex h-[18px] items-center gap-1 rounded-full px-2 font-bold text-[10px] leading-none"
          style={{
            color: laneColor,
            backgroundColor: `color-mix(in srgb, ${laneColor} 28%, transparent)`,
          }}
        >
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
          {b.name}
        </span>,
      );
      fullList.push(`HEAD → ${b.name}`);
    } else {
      items.push(
        <span
          key={`l:${b.fullName}`}
          className="inline-flex h-[18px] items-center rounded-full bg-muted/60 px-2 font-medium text-[10px] text-muted-foreground leading-none"
        >
          {b.name}
        </span>,
      );
      fullList.push(b.name);
    }
  }

  for (const r of entry.remotes) {
    if (consumed.has(r.fullName)) continue;
    const label = r.remote ? `${r.remote}/${r.name}` : r.name;
    items.push(
      <span key={`r:${r.fullName}`} className="text-[10px] italic">
        {label}
      </span>,
    );
    fullList.push(label);
  }

  for (const t of entry.tags) {
    items.push(
      <span
        key={`t:${t.fullName}`}
        className="inline-flex h-[18px] items-center rounded-sm bg-muted px-1.5 text-[10px] text-muted-foreground leading-none"
      >
        #{t.name}
      </span>,
    );
    fullList.push(`#${t.name}`);
  }

  if (items.length === 0) return null;

  const visible = items.slice(0, MAX_CHIPS);
  const overflow = items.length - visible.length;

  const cluster = (
    <div className="flex shrink-0 items-center gap-1.5">
      {visible}
      {overflow > 0 && <span className="text-[10px]">+{overflow} more</span>}
    </div>
  );

  if (overflow === 0 && items.length === 1) return cluster;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cluster}</TooltipTrigger>
      <TooltipContent>
        <div className="flex flex-col gap-0.5 text-xs">
          {fullList.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});

const WorkingTreeRow = memo(function WorkingTreeRow({
  width,
  color,
  dirtyCount,
  conflictCount,
  onClick,
}: {
  width: number;
  color: string;
  dirtyCount: number;
  conflictCount: number;
  onClick: () => void;
}) {
  const height = 56;
  const mid = height / 2;
  const x = GRAPH_PAD_LEFT + LANE_WIDTH / 2;
  const ariaLabel =
    conflictCount > 0
      ? `Working tree: ${dirtyCount} change${dirtyCount === 1 ? "" : "s"}, ${conflictCount} conflict${conflictCount === 1 ? "" : "s"}. Open Changes view.`
      : `Working tree: ${dirtyCount} uncommitted change${dirtyCount === 1 ? "" : "s"}. Open Changes view.`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title="Open in Changes view"
      className="group/wt flex w-full items-center gap-3 border-b border-border/50 pr-2 text-left hover:bg-muted/40"
      style={{ minHeight: height }}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="shrink-0"
        aria-hidden="true"
      >
        <line
          x1={x}
          y1={mid}
          x2={x}
          y2={height}
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <circle
          cx={x}
          cy={mid}
          r={DOT_RADIUS}
          fill="var(--background)"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeDasharray="2.5 2"
        />
      </svg>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-muted/30 text-muted-foreground">
        <Pencil className="h-3.5 w-3.5" />
      </span>
      <code className="w-[4.5rem] shrink-0 font-mono text-xs italic text-muted-foreground">
        working
      </code>
      <div className="min-w-0 flex-1 py-1.5">
        <div className="truncate text-sm italic text-foreground/90">Uncommitted changes</div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          {dirtyCount > 0 && (
            <span>
              {dirtyCount} change{dirtyCount === 1 ? "" : "s"}
            </span>
          )}
          {conflictCount > 0 && (
            <Badge
              variant="destructive"
              className="h-4 gap-1 px-1.5 text-[10px] font-normal not-italic"
            >
              <AlertTriangle className="h-3 w-3" />
              {conflictCount} conflict{conflictCount === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
      </div>
      <span className="ml-1 shrink-0 text-xs text-muted-foreground opacity-0 transition-opacity group-hover/wt:opacity-100">
        Open →
      </span>
    </button>
  );
});

const GraphCell = memo(function GraphCell({
  row,
  height,
  width,
  isDark,
  unpushed,
}: {
  row: GraphRow;
  height: number;
  width: number;
  isDark: boolean;
  unpushed?: boolean;
}) {
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
        stroke={laneColor(row.incomingColors[i], isDark)}
        strokeWidth={STROKE_WIDTH}
        opacity={i === row.lane ? 1 : 0.8}
      />,
    );
  }

  // Outgoing (bottom half).
  const parentLaneSet = new Set(row.parentLanes);
  for (let i = 0; i < row.outgoingLanes.length; i++) {
    if (!row.outgoingLanes[i]) continue;
    const x = laneX(i);
    const color = laneColor(row.outgoingColors[i], isDark);
    const isParentEdge = parentLaneSet.has(i);
    if (isParentEdge) {
      const from = { x: laneX(row.lane), y: mid };
      const to = { x, y: height };
      const c1y = mid + (height - mid) * 0.55;
      const path = `M ${from.x} ${from.y} C ${from.x} ${c1y}, ${to.x} ${c1y}, ${to.x} ${to.y}`;
      bottomSegments.push(
        <path key={`b-${i}`} d={path} stroke={color} strokeWidth={STROKE_WIDTH} fill="none" />,
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
          strokeWidth={STROKE_WIDTH}
          opacity={0.8}
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
        fill={unpushed ? "var(--background)" : laneColor(row.color, isDark)}
        stroke={unpushed ? laneColor(row.color, isDark) : "var(--background)"}
        strokeWidth={unpushed ? STROKE_WIDTH : 2}
      />
    </svg>
  );
});
