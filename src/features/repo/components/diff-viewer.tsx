import { Copy, Hash, WrapText } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Highlighter, ThemedToken } from "shiki";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import type { FileDiff } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";
import { useFileDiff } from "../hooks/use-commit-details";

export type HunkAction = {
  label: string;
  onClick: (hunkIndex: number) => void;
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
    }
  | {
      data: FileDiff;
      inline?: boolean;
      hunkActions?: HunkAction[];
      repoPath?: undefined;
      commitId?: undefined;
      filePath?: undefined;
    };

export function DiffViewer(props: Props) {
  if ("data" in props && props.data) {
    return <DiffBody data={props.data} hunkActions={props.hunkActions} />;
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
  const { data, isLoading, error } = useFileDiff(repoPath, commitId, filePath);
  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading diff…</div>;
  if (error) return <div className="p-4 text-xs text-destructive">{(error as Error).message}</div>;
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

function useIsDark(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document === "undefined" ? false : document.documentElement.classList.contains("dark"),
  );
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains("dark")));
    obs.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return isDark;
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

function HighlightedLine({
  hl,
  lang,
  content,
  isDark,
}: {
  hl: Highlighter | null;
  lang: string | null;
  content: string;
  isDark: boolean;
}) {
  const tokens: ThemedToken[] | null = useMemo(() => {
    if (!hl || !lang) return null;
    return tokenizeLine(hl, content, lang, isDark ? DARK_THEME : LIGHT_THEME);
  }, [hl, lang, content, isDark]);

  if (!tokens) return <>{content || " "}</>;
  return (
    <>
      {tokens.map((t, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: tokens are stable for a given line
        <span key={i} style={{ color: t.color }}>
          {t.content}
        </span>
      ))}
    </>
  );
}

function DiffBody({ data, hunkActions }: { data: FileDiff; hunkActions?: HunkAction[] }) {
  const { hl, lang } = useHighlighter(data.path);
  const isDark = useIsDark();
  const wordWrap = useUiStore((s) => s.diffWordWrap);
  const toggleWrap = useUiStore((s) => s.toggleDiffWordWrap);
  const showLineNumbers = useUiStore((s) => s.diffLineNumbers);
  const toggleLineNumbers = useUiStore((s) => s.toggleDiffLineNumbers);

  const scrollRef = useRef<HTMLDivElement>(null);
  const hunkRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeHunk, setActiveHunk] = useState(0);

  const hunkCount = data.hunks.length;

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
          hunkRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      } else if (e.key === "k") {
        e.preventDefault();
        setActiveHunk((a) => {
          const next = Math.max(0, a - 1);
          hunkRefs.current[next]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hunkCount]);

  useEffect(() => {
    setActiveHunk(0);
    hunkRefs.current = [];
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

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b bg-background/60 px-2 py-1">
        <span className="truncate px-1 text-xs text-muted-foreground">
          {hunkCount > 1 ? `Hunk ${activeHunk + 1} of ${hunkCount} · j/k to navigate` : null}
        </span>
        <div className="flex shrink-0 items-center gap-1">
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
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[12px] leading-5">
        {data.hunks.map((hunk, hi) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: diff hunks are immutable for a given file/commit
            key={hi}
            ref={(el) => {
              hunkRefs.current[hi] = el;
            }}
            className={cn(
              "border-b border-border/50",
              activeHunk === hi && "ring-1 ring-inset ring-primary/30",
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
                    copyHunk(hi);
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
                      a.onClick(hi);
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              {hunk.lines.map((line, li) => {
                const bg =
                  line.kind === "addition"
                    ? "bg-emerald-500/10"
                    : line.kind === "deletion"
                      ? "bg-rose-500/10"
                      : "";
                const marker =
                  line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
                return (
                  <div
                    // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are immutable for a given file/commit
                    key={li}
                    className={cn("flex", !wordWrap && "w-max min-w-full", bg)}
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
                    <span className="w-4 shrink-0 select-none text-muted-foreground/80">
                      {marker}
                    </span>
                    <span
                      className={cn(
                        "flex-1 px-2",
                        wordWrap ? "whitespace-pre-wrap break-all" : "whitespace-pre",
                      )}
                    >
                      <HighlightedLine hl={hl} lang={lang} content={line.content} isDark={isDark} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
