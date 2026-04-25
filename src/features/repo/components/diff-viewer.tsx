import { useVirtualizer } from "@tanstack/react-virtual";
import { Columns2, Copy, Hash, Rows2, WrapText } from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { Highlighter, ThemedToken } from "shiki";
import { toast } from "sonner";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsDark } from "@/hooks/use-is-dark";
import {
  awaitHighlighter,
  DARK_THEME,
  ensureLanguage,
  getHighlighterIfReady,
  LIGHT_THEME,
  langFromPath,
  tokenizeLine,
} from "@/lib/highlighter";
import { serializeHunkForClipboard } from "@/lib/patch";
import type { DiffLine, FileDiff } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { wordDiffRanges } from "@/lib/word-diff";
import { useUiStore } from "@/stores/ui-store";
import { useFileDiff } from "../hooks/use-commit-details";

export type HunkAction = {
  label: string;
  onClick: (hunkIndex: number) => void;
  destructive?: boolean;
  disabled?: boolean;
};

export type LineAction = {
  label: string;
  // Receives the user's selection — pairs of hunk + line index — so the parent
  // can build a partial-line patch and apply it.
  onClick: (lines: ReadonlyArray<{ hunkIdx: number; lineIdx: number }>) => void;
  destructive?: boolean;
  disabled?: boolean;
};

type Props =
  | {
      repoPath: string;
      commitId: string;
      filePath: string;
      data?: undefined;
      inline?: undefined;
      hunkActions?: undefined;
      lineActions?: undefined;
    }
  | {
      data: FileDiff;
      inline?: boolean;
      hunkActions?: HunkAction[];
      lineActions?: LineAction[];
      repoPath?: undefined;
      commitId?: undefined;
      filePath?: undefined;
    };

export function DiffViewer(props: Props) {
  if ("data" in props && props.data) {
    return (
      <DiffBody data={props.data} hunkActions={props.hunkActions} lineActions={props.lineActions} />
    );
  }
  return (
    <FetchingDiff
      repoPath={props.repoPath as string}
      commitId={props.commitId as string}
      filePath={props.filePath as string}
    />
  );
}

function FetchingDiff({
  repoPath,
  commitId,
  filePath,
}: {
  repoPath: string;
  commitId: string;
  filePath: string;
}) {
  const { data, isLoading, error, refetch } = useFileDiff(repoPath, commitId, filePath);
  if (isLoading) return <LoadingState label="Loading diff…" />;
  if (error) return <ErrorState error={error as Error} onRetry={() => void refetch()} />;
  if (!data) return null;
  return <DiffBody data={data} />;
}

function ImageDiff({ data }: { data: FileDiff }) {
  const mime = data.imageMimeType as string;
  const oldSrc = data.oldImage ? `data:${mime};base64,${data.oldImage}` : null;
  const newSrc = data.newImage ? `data:${mime};base64,${data.newImage}` : null;
  return (
    <div className="grid h-full grid-cols-2 gap-3 overflow-auto p-3">
      <ImagePane label="Before" src={oldSrc} size={data.oldSize} dimensions={data.oldDimensions} />
      <ImagePane label="After" src={newSrc} size={data.newSize} dimensions={data.newDimensions} />
    </div>
  );
}

function ImagePane({
  label,
  src,
  size,
  dimensions,
}: {
  label: string;
  src: string | null;
  size?: number;
  dimensions?: { width: number; height: number };
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
        <span>{label}</span>
        {src && (
          <span className="font-mono text-[11px]">
            {dimensions ? `${dimensions.width}×${dimensions.height}` : null}
            {dimensions && size !== undefined ? " · " : null}
            {size !== undefined ? formatBytes(size) : null}
          </span>
        )}
      </div>
      <div className="flex min-h-32 items-center justify-center rounded border border-border/50 bg-[repeating-conic-gradient(theme(colors.muted)_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-2">
        {src ? (
          <img src={src} alt={label} className="max-h-[70vh] max-w-full object-contain" />
        ) : (
          <span className="text-xs text-muted-foreground">No file</span>
        )}
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}

function useHighlighter(path: string): { hl: Highlighter | null; lang: string | null } {
  const lang = useMemo(() => langFromPath(path), [path]);
  const [hl, setHl] = useState<Highlighter | null>(() => getHighlighterIfReady());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!lang) return;
    let cancelled = false;
    (async () => {
      const h = await awaitHighlighter();
      const ok = await ensureLanguage(lang);
      if (cancelled) return;
      setHl(h);
      setReady(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [lang]);

  return { hl: ready ? hl : null, lang };
}

type WordHighlight = { ranges: Array<[number, number]>; className: string };

// Render `content` either as plain text or via Shiki tokens, optionally
// overlaying a word-diff highlight: substrings inside `highlight.ranges` get
// `highlight.className` applied as a background.
const HighlightedLine = memo(function HighlightedLine({
  hl,
  lang,
  content,
  isDark,
  highlight,
}: {
  hl: Highlighter | null;
  lang: string | null;
  content: string;
  isDark: boolean;
  highlight?: WordHighlight;
}) {
  const tokens: ThemedToken[] | null = useMemo(() => {
    if (!hl || !lang) return null;
    return tokenizeLine(hl, content, lang, isDark ? DARK_THEME : LIGHT_THEME);
  }, [hl, lang, content, isDark]);

  // Fast path — no syntax tokens, no word-diff. Render the line as-is.
  if (!tokens && (!highlight || highlight.ranges.length === 0)) return <>{content || " "}</>;

  const segments: Array<{ text: string; color?: string; highlighted: boolean }> = [];
  const ranges = highlight?.ranges ?? [];
  const hlClass = highlight?.className ?? "";

  const isInRange = (offset: number): boolean => {
    for (const [s, e] of ranges) {
      if (offset >= s && offset < e) return true;
    }
    return false;
  };
  const nextBoundary = (offset: number): number => {
    let next = Number.POSITIVE_INFINITY;
    for (const [s, e] of ranges) {
      if (s > offset && s < next) next = s;
      if (e > offset && e < next) next = e;
    }
    return next;
  };

  const emit = (text: string, color: string | undefined, baseOffset: number) => {
    if (ranges.length === 0) {
      segments.push({ text, color, highlighted: false });
      return;
    }
    let cursor = 0;
    while (cursor < text.length) {
      const absolute = baseOffset + cursor;
      const inside = isInRange(absolute);
      const boundary = nextBoundary(absolute);
      const stop = Math.min(text.length, cursor + (boundary - absolute));
      segments.push({ text: text.slice(cursor, stop), color, highlighted: inside });
      cursor = stop;
    }
  };

  if (tokens) {
    let offset = 0;
    for (const t of tokens) {
      emit(t.content, t.color, offset);
      offset += t.content.length;
    }
  } else {
    emit(content || " ", undefined, 0);
  }

  return (
    <>
      {segments.map((seg, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: segments are stable for a given line
          key={i}
          style={seg.color ? { color: seg.color } : undefined}
          className={seg.highlighted ? hlClass : undefined}
        >
          {seg.text}
        </span>
      ))}
    </>
  );
});

type DiffRow =
  | { kind: "header"; hunkIdx: number }
  | { kind: "line"; hunkIdx: number; lineIdx: number }
  | {
      kind: "split";
      hunkIdx: number;
      left: DiffLine | null;
      right: DiffLine | null;
      leftIdx: number | null;
      rightIdx: number | null;
    };

const HEADER_ROW_PX = 28;
const LINE_ROW_PX = 20;

// Pair up consecutive deletions/additions inside a hunk so split-view rows
// show the corresponding "before" and "after" line on the same row. Context
// lines flush any pending pairs and appear on both sides. The returned indices
// point back into the hunk's `lines` array so callers can look up per-line
// metadata (e.g. word-diff ranges).
type SplitPair = {
  left: DiffLine | null;
  right: DiffLine | null;
  leftIdx: number | null;
  rightIdx: number | null;
};

function pairHunkLines(lines: DiffLine[]): SplitPair[] {
  const out: SplitPair[] = [];
  let pendingDel: Array<{ line: DiffLine; idx: number }> = [];
  let pendingAdd: Array<{ line: DiffLine; idx: number }> = [];
  const flush = () => {
    const n = Math.max(pendingDel.length, pendingAdd.length);
    for (let i = 0; i < n; i++) {
      out.push({
        left: pendingDel[i]?.line ?? null,
        right: pendingAdd[i]?.line ?? null,
        leftIdx: pendingDel[i]?.idx ?? null,
        rightIdx: pendingAdd[i]?.idx ?? null,
      });
    }
    pendingDel = [];
    pendingAdd = [];
  };
  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (line.kind === "context") {
      flush();
      out.push({ left: line, right: line, leftIdx: idx, rightIdx: idx });
    } else if (line.kind === "deletion") {
      pendingDel.push({ line, idx });
    } else {
      pendingAdd.push({ line, idx });
    }
  }
  flush();
  return out;
}

function DiffBody({
  data,
  hunkActions,
  lineActions,
}: {
  data: FileDiff;
  hunkActions?: HunkAction[];
  lineActions?: LineAction[];
}) {
  const { hl, lang } = useHighlighter(data.path);
  const isDark = useIsDark();
  const wordWrap = useUiStore((s) => s.diffWordWrap);
  const toggleWrap = useUiStore((s) => s.toggleDiffWordWrap);
  const showLineNumbers = useUiStore((s) => s.diffLineNumbers);
  const toggleLineNumbers = useUiStore((s) => s.toggleDiffLineNumbers);
  const layout = useUiStore((s) => s.diffLayout);
  const toggleLayout = useUiStore((s) => s.toggleDiffLayout);
  const wordHighlight = useUiStore((s) => s.diffWordHighlight);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeHunk, setActiveHunk] = useState(0);

  // Per-line selection for the partial-staging UI. Constrained to a single
  // hunk at a time so we don't have to renumber subsequent hunks when
  // demoting unselected `-` lines back to context.
  const [selection, setSelection] = useState<{ hunkIdx: number; lines: Set<number> } | null>(null);
  const selectionAnchorRef = useRef<number | null>(null);

  const hunkCount = data.hunks.length;

  // Drop selection whenever the underlying diff changes — e.g. file switch,
  // status invalidation after a stage. Use the path + hunk count + first hunk
  // header as a cheap fingerprint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional fingerprint
  useEffect(() => {
    setSelection(null);
    selectionAnchorRef.current = null;
  }, [data.path, hunkCount, data.hunks[0]?.header]);

  const canSelectLines = !!lineActions && lineActions.length > 0;

  const handleLineClick = (hunkIdx: number, lineIdx: number, shiftKey: boolean) => {
    if (!canSelectLines) return;
    const line = data.hunks[hunkIdx]?.lines[lineIdx];
    if (!line || line.kind === "context") return;

    const sameHunk = selection?.hunkIdx === hunkIdx;
    if (!sameHunk) {
      setSelection({ hunkIdx, lines: new Set([lineIdx]) });
      selectionAnchorRef.current = lineIdx;
      return;
    }

    const current = selection.lines;
    if (shiftKey && selectionAnchorRef.current !== null) {
      const anchor = selectionAnchorRef.current;
      const start = Math.min(anchor, lineIdx);
      const end = Math.max(anchor, lineIdx);
      const next = new Set(current);
      for (let i = start; i <= end; i++) {
        const l = data.hunks[hunkIdx].lines[i];
        if (l && l.kind !== "context") next.add(i);
      }
      setSelection({ hunkIdx, lines: next });
      return;
    }

    const next = new Set(current);
    if (next.has(lineIdx)) next.delete(lineIdx);
    else next.add(lineIdx);
    if (next.size === 0) {
      setSelection(null);
      selectionAnchorRef.current = null;
    } else {
      setSelection({ hunkIdx, lines: next });
      selectionAnchorRef.current = lineIdx;
    }
  };

  // Pre-compute, per hunk, a map keyed by line index → word-diff highlight
  // ranges. Only paired deletion/addition lines participate; everything else
  // gets no extra highlight. Skipped entirely when the user disabled it in
  // settings.
  const wordDiffByHunk = useMemo(() => {
    const out = new Map<number, Map<number, Array<[number, number]>>>();
    if (!wordHighlight) return out;
    for (let hi = 0; hi < data.hunks.length; hi++) {
      const lines = data.hunks[hi].lines;
      const perHunk = new Map<number, Array<[number, number]>>();
      let i = 0;
      while (i < lines.length) {
        if (lines[i].kind === "deletion") {
          let delEnd = i;
          while (delEnd < lines.length && lines[delEnd].kind === "deletion") delEnd++;
          let addEnd = delEnd;
          while (addEnd < lines.length && lines[addEnd].kind === "addition") addEnd++;
          const delCount = delEnd - i;
          const addCount = addEnd - delEnd;
          const pairs = Math.min(delCount, addCount);
          for (let k = 0; k < pairs; k++) {
            const aLine = lines[i + k];
            const bLine = lines[delEnd + k];
            const { left, right } = wordDiffRanges(aLine.content, bLine.content);
            if (left.length) perHunk.set(i + k, left);
            if (right.length) perHunk.set(delEnd + k, right);
          }
          i = addEnd;
        } else {
          i++;
        }
      }
      if (perHunk.size > 0) out.set(hi, perHunk);
    }
    return out;
  }, [data.hunks, wordHighlight]);

  const { rows, headerIndices } = useMemo(() => {
    const out: DiffRow[] = [];
    const heads: number[] = [];
    for (let hi = 0; hi < data.hunks.length; hi++) {
      heads.push(out.length);
      out.push({ kind: "header", hunkIdx: hi });
      const hunk = data.hunks[hi];
      if (layout === "split") {
        for (const p of pairHunkLines(hunk.lines)) {
          out.push({
            kind: "split",
            hunkIdx: hi,
            left: p.left,
            right: p.right,
            leftIdx: p.leftIdx,
            rightIdx: p.rightIdx,
          });
        }
      } else {
        for (let li = 0; li < hunk.lines.length; li++) {
          out.push({ kind: "line", hunkIdx: hi, lineIdx: li });
        }
      }
    }
    return { rows: out, headerIndices: heads };
  }, [data.hunks, layout]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i]?.kind === "header" ? HEADER_ROW_PX : LINE_ROW_PX),
    overscan: 24,
  });

  useEffect(() => {
    if (hunkCount === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) {
          return;
        }
      }
      if (e.key === "j") {
        e.preventDefault();
        setActiveHunk((a) => {
          const next = Math.min(hunkCount - 1, a + 1);
          virtualizer.scrollToIndex(headerIndices[next] ?? 0, { align: "start" });
          return next;
        });
      } else if (e.key === "k") {
        e.preventDefault();
        setActiveHunk((a) => {
          const next = Math.max(0, a - 1);
          virtualizer.scrollToIndex(headerIndices[next] ?? 0, { align: "start" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hunkCount, virtualizer, headerIndices]);

  useEffect(() => {
    setActiveHunk(0);
  }, []);

  if (data.isBinary) {
    if (data.imageMimeType && (data.oldImage || data.newImage)) {
      return <ImageDiff data={data} />;
    }
    return <div className="p-4 text-xs text-muted-foreground">Binary file not shown.</div>;
  }
  if (data.hunks.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No textual changes.</div>;
  }

  const copyHunk = async (hi: number) => {
    try {
      await navigator.clipboard.writeText(serializeHunkForClipboard(data.hunks[hi]));
      toast.success("Hunk copied", { duration: 1200 });
    } catch (err) {
      toast.error(`Couldn't copy: ${(err as Error).message}`);
    }
  };

  const totalSize = virtualizer.getTotalSize();
  const items = virtualizer.getVirtualItems();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-2 py-1">
        <span
          className="min-w-0 truncate px-1 font-mono text-xs text-muted-foreground"
          title={data.path}
        >
          {data.path}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {hunkCount > 1 && (
            <span className="mr-1 hidden items-center gap-1 text-[11px] text-muted-foreground tabular-nums sm:inline-flex">
              <span>
                Hunk <span className="text-foreground/80">{activeHunk + 1}</span> of {hunkCount}
              </span>
              <span className="opacity-50">·</span>
              <kbd className="rounded border border-border bg-muted/60 px-1 font-mono text-[10px]">
                j
              </kbd>
              <kbd className="rounded border border-border bg-muted/60 px-1 font-mono text-[10px]">
                k
              </kbd>
            </span>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={layout === "split"}
                onPressedChange={toggleLayout}
                aria-label={layout === "split" ? "Switch to unified diff" : "Switch to split diff"}
                className="h-6 w-6 p-0"
              >
                {layout === "split" ? (
                  <Columns2 className="h-3.5 w-3.5" />
                ) : (
                  <Rows2 className="h-3.5 w-3.5" />
                )}
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>{layout === "split" ? "Split view" : "Unified view"}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={showLineNumbers}
                onPressedChange={toggleLineNumbers}
                aria-label="Toggle line numbers"
                className="h-6 w-6 p-0"
              >
                <Hash className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Line numbers</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Toggle
                size="sm"
                pressed={wordWrap}
                onPressedChange={toggleWrap}
                aria-label="Toggle word wrap"
                className="h-6 w-6 p-0"
              >
                <WrapText className="h-3.5 w-3.5" />
              </Toggle>
            </TooltipTrigger>
            <TooltipContent>Word wrap</TooltipContent>
          </Tooltip>
        </div>
      </div>
      {selection && lineActions && lineActions.length > 0 && (
        <div className="flex items-center justify-between gap-2 border-b bg-primary/5 px-3 py-1.5 text-xs">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{selection.lines.size}</span> line
            {selection.lines.size === 1 ? "" : "s"} selected · hunk {selection.hunkIdx + 1}
          </span>
          <div className="flex items-center gap-1">
            {lineActions.map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant={a.destructive ? "ghost" : "default"}
                className={cn(
                  "h-6 px-2 text-xs",
                  a.destructive && "text-muted-foreground hover:text-destructive",
                )}
                disabled={a.disabled || selection.lines.size === 0}
                onClick={() => {
                  const lines = [...selection.lines]
                    .sort((x, y) => x - y)
                    .map((lineIdx) => ({ hunkIdx: selection.hunkIdx, lineIdx }));
                  a.onClick(lines);
                  setSelection(null);
                  selectionAnchorRef.current = null;
                }}
              >
                {a.label}
              </Button>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={() => {
                setSelection(null);
                selectionAnchorRef.current = null;
              }}
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[12px] leading-5">
        <div style={{ height: totalSize, position: "relative", width: "100%" }}>
          {items.map((vi) => {
            const row = rows[vi.index];
            const style: React.CSSProperties = {
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${vi.start}px)`,
            };
            if (row.kind === "header") {
              const hunk = data.hunks[row.hunkIdx];
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={style}
                  className={cn(
                    "border-b border-border/50",
                    activeHunk === row.hunkIdx && "ring-1 ring-inset ring-primary/30",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 bg-muted/60 px-3 py-1">
                    <span className="truncate text-muted-foreground">{hunk.header}</span>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0 text-muted-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyHunk(row.hunkIdx);
                        }}
                        aria-label="Copy hunk"
                        title="Copy hunk"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {hunkActions?.map((a) => (
                        <Button
                          key={a.label}
                          size="sm"
                          variant="ghost"
                          className={
                            a.destructive
                              ? "h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                              : "h-6 px-2 text-xs"
                          }
                          disabled={a.disabled}
                          onClick={(e) => {
                            e.stopPropagation();
                            a.onClick(row.hunkIdx);
                          }}
                        >
                          {a.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }
            if (row.kind === "split") {
              const perHunk = wordDiffByHunk.get(row.hunkIdx);
              const leftRanges = row.leftIdx !== null ? perHunk?.get(row.leftIdx) : undefined;
              const rightRanges = row.rightIdx !== null ? perHunk?.get(row.rightIdx) : undefined;
              const leftSelected =
                row.leftIdx !== null &&
                selection?.hunkIdx === row.hunkIdx &&
                selection.lines.has(row.leftIdx);
              const rightSelected =
                row.rightIdx !== null &&
                selection?.hunkIdx === row.hunkIdx &&
                selection.lines.has(row.rightIdx);
              return (
                <div
                  key={vi.key}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={style}
                  className="flex w-full"
                >
                  <SplitCell
                    line={row.left}
                    side="left"
                    showLineNumbers={showLineNumbers}
                    wordWrap={wordWrap}
                    hl={hl}
                    lang={lang}
                    isDark={isDark}
                    wordRanges={leftRanges}
                    selected={leftSelected}
                    onClick={
                      canSelectLines && row.leftIdx !== null
                        ? (shift) => handleLineClick(row.hunkIdx, row.leftIdx as number, shift)
                        : undefined
                    }
                  />
                  <SplitCell
                    line={row.right}
                    side="right"
                    showLineNumbers={showLineNumbers}
                    wordWrap={wordWrap}
                    hl={hl}
                    lang={lang}
                    isDark={isDark}
                    wordRanges={rightRanges}
                    selected={rightSelected}
                    onClick={
                      canSelectLines && row.rightIdx !== null
                        ? (shift) => handleLineClick(row.hunkIdx, row.rightIdx as number, shift)
                        : undefined
                    }
                  />
                </div>
              );
            }
            const line = data.hunks[row.hunkIdx].lines[row.lineIdx];
            const isSelectable = canSelectLines && line.kind !== "context";
            const isSelected =
              selection?.hunkIdx === row.hunkIdx && selection.lines.has(row.lineIdx);
            const baseBg =
              line.kind === "addition"
                ? "bg-emerald-500/10"
                : line.kind === "deletion"
                  ? "bg-rose-500/10"
                  : "";
            const selectedBg =
              line.kind === "addition"
                ? "bg-emerald-500/25"
                : line.kind === "deletion"
                  ? "bg-rose-500/25"
                  : "";
            const bg = isSelected ? selectedBg : baseBg;
            const marker = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
            const lineRanges = wordDiffByHunk.get(row.hunkIdx)?.get(row.lineIdx);
            const highlight: WordHighlight | undefined = lineRanges
              ? {
                  ranges: lineRanges,
                  className: line.kind === "addition" ? "bg-emerald-500/40" : "bg-rose-500/40",
                }
              : undefined;
            return (
              // biome-ignore lint/a11y/noStaticElementInteractions: role is set conditionally below
              // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-pressed is valid on role=button per WAI-ARIA 1.2
              <div
                key={vi.key}
                data-index={vi.index}
                ref={virtualizer.measureElement}
                style={style}
                onClick={
                  isSelectable
                    ? (e) => handleLineClick(row.hunkIdx, row.lineIdx, e.shiftKey)
                    : undefined
                }
                onKeyDown={
                  isSelectable
                    ? (e) => {
                        if (e.key === " " || e.key === "Enter") {
                          e.preventDefault();
                          handleLineClick(row.hunkIdx, row.lineIdx, e.shiftKey);
                        }
                      }
                    : undefined
                }
                role={isSelectable ? "button" : undefined}
                tabIndex={isSelectable ? 0 : undefined}
                aria-pressed={isSelectable ? isSelected : undefined}
                className={cn(
                  "flex",
                  !wordWrap && "w-max min-w-full",
                  bg,
                  isSelectable && "cursor-pointer hover:brightness-110",
                  isSelected && "ring-1 ring-inset ring-primary/50",
                )}
              >
                {showLineNumbers && (
                  <>
                    <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70">
                      {line.oldLine ?? ""}
                    </span>
                    <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70">
                      {line.newLine ?? ""}
                    </span>
                  </>
                )}
                <span className="w-4 shrink-0 select-none text-muted-foreground/80">{marker}</span>
                <span
                  className={cn(
                    "flex-1 px-2",
                    wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre",
                  )}
                >
                  <HighlightedLine
                    hl={hl}
                    lang={lang}
                    content={line.content}
                    isDark={isDark}
                    highlight={highlight}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SplitCell({
  line,
  side,
  showLineNumbers,
  wordWrap,
  hl,
  lang,
  isDark,
  wordRanges,
  selected,
  onClick,
}: {
  line: DiffLine | null;
  side: "left" | "right";
  showLineNumbers: boolean;
  wordWrap: boolean;
  hl: Highlighter | null;
  lang: string | null;
  isDark: boolean;
  wordRanges?: Array<[number, number]>;
  selected?: boolean;
  onClick?: (shiftKey: boolean) => void;
}) {
  // Empty side of a paired add/remove block — render a muted filler so both
  // columns stay aligned.
  if (!line) {
    return (
      <div
        className={cn(
          "flex w-1/2 min-w-0 border-border/50 bg-muted/20",
          side === "left" ? "border-r" : "",
        )}
      >
        {showLineNumbers && (
          <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70" />
        )}
        <span className="w-4 shrink-0 select-none text-muted-foreground/40"> </span>
        <span className="flex-1 px-2"> </span>
      </div>
    );
  }
  const isSelectable = !!onClick && line.kind !== "context";
  const baseBg =
    line.kind === "addition"
      ? "bg-emerald-500/10"
      : line.kind === "deletion"
        ? "bg-rose-500/10"
        : "";
  const selectedBg =
    line.kind === "addition"
      ? "bg-emerald-500/25"
      : line.kind === "deletion"
        ? "bg-rose-500/25"
        : "";
  const bg = selected ? selectedBg : baseBg;
  const marker = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
  const lineNumber = side === "left" ? (line.oldLine ?? "") : (line.newLine ?? "");
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: role is set conditionally below
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-pressed is valid on role=button per WAI-ARIA 1.2
    <div
      onClick={isSelectable ? (e) => onClick?.(e.shiftKey) : undefined}
      onKeyDown={
        isSelectable
          ? (e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                onClick?.(e.shiftKey);
              }
            }
          : undefined
      }
      role={isSelectable ? "button" : undefined}
      tabIndex={isSelectable ? 0 : undefined}
      aria-pressed={isSelectable ? selected : undefined}
      className={cn(
        "flex w-1/2 min-w-0 border-border/50",
        side === "left" ? "border-r" : "",
        bg,
        isSelectable && "cursor-pointer hover:brightness-110",
        selected && "ring-1 ring-inset ring-primary/50",
      )}
    >
      {showLineNumbers && (
        <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70 tabular-nums">
          {lineNumber}
        </span>
      )}
      <span className="w-4 shrink-0 select-none text-muted-foreground/80">{marker}</span>
      <span
        className={cn(
          "min-w-0 flex-1 overflow-hidden px-2",
          wordWrap ? "whitespace-pre-wrap break-all" : "truncate whitespace-pre",
        )}
      >
        <HighlightedLine
          hl={hl}
          lang={lang}
          content={line.content}
          isDark={isDark}
          highlight={
            wordRanges && wordRanges.length > 0
              ? {
                  ranges: wordRanges,
                  className: line.kind === "addition" ? "bg-emerald-500/40" : "bg-rose-500/40",
                }
              : undefined
          }
        />
      </span>
    </div>
  );
}
