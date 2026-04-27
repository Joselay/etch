import { format, formatDistanceToNow } from "date-fns";
import { Check, Copy } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FileIcon } from "@/components/file-icon";
import { ErrorState } from "@/components/states";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChangeStatus, CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useCommitChanges, useCommitMessage } from "../hooks/use-commit-details";
import { AuthorAvatar } from "./author-avatar";
import { DiffViewer } from "./diff-viewer";
import { FileRowContextMenu } from "./file-row-context-menu";
import { FileTree, TreeIndentGuides, TreeLeafSpacer } from "./file-tree";

type Props = { repoPath: string };

export function CommitDetails({ repoPath }: Props) {
  const { selectedCommitId, selectedCommit: commit, selectedFilePath } = useTabSelection(repoPath);
  const selectFile = useSelectionStore((s) => s.selectFile);
  const { data, isLoading, error, refetch } = useCommitChanges(repoPath, selectedCommitId);

  useEffect(() => {
    if (data && data.length > 0 && !selectedFilePath) {
      selectFile(repoPath, data[0].path);
    }
  }, [data, selectedFilePath, selectFile, repoPath]);

  if (!selectedCommitId) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyDescription>Select a commit to see its changes.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {commit && <CommitHeader commit={commit} repoPath={repoPath} />}
      <ResizablePanelGroup
        id="etch:commit-details-inner:v1"
        orientation="horizontal"
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="etch:commit-files" defaultSize="28%" minSize="15%" maxSize="60%">
          <aside className="h-full overflow-hidden border-r">
            <div className="h-full overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col gap-1 p-2">
                  {["a", "b", "c", "d"].map((k) => (
                    <Skeleton key={k} className="h-6 w-full" />
                  ))}
                </div>
              ) : error ? (
                <ErrorState
                  error={error as Error}
                  title="Couldn't load changes"
                  onRetry={() => void refetch()}
                  tone="compact"
                />
              ) : data && data.length > 0 ? (
                <FileTree
                  items={data}
                  persistKey={`${repoPath}:commit-details`}
                  renderItem={(f, { depth, displayName, indentPx }) => {
                    const selected = selectedFilePath === f.path;
                    return (
                      <FileRowContextMenu key={f.path} repoPath={repoPath} relPath={f.path}>
                        <button
                          type="button"
                          data-selected={selected || undefined}
                          onClick={() => selectFile(repoPath, f.path)}
                          className={cn(
                            "group flex w-full min-w-0 cursor-pointer items-stretch text-left text-[13px]",
                            "hover:bg-muted/60",
                            "data-[selected]:bg-primary/10 data-[selected]:text-foreground",
                          )}
                        >
                          <TreeIndentGuides depth={depth} indentPx={indentPx} />
                          <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-3">
                            <TreeLeafSpacer />
                            <FileIcon path={f.path} />
                            <span className="min-w-0 flex-1 truncate">{displayName}</span>
                            <StatusBadge status={f.status} />
                          </div>
                        </button>
                      </FileRowContextMenu>
                    );
                  }}
                />
              ) : (
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyDescription>No file changes.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </div>
          </aside>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="etch:commit-diff" defaultSize="72%" minSize="30%">
          <section className="h-full min-w-0">
            {selectedFilePath && selectedCommitId && (
              <DiffViewer
                repoPath={repoPath}
                commitId={selectedCommitId}
                filePath={selectedFilePath}
              />
            )}
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function CommitHeader({ commit, repoPath }: { commit: CommitSummary; repoPath: string }) {
  const authored = new Date(commit.timestamp * 1000);
  const committed = new Date(commit.committerTimestamp * 1000);
  const differentCommitter =
    commit.committerEmail !== commit.authorEmail ||
    commit.committerName !== commit.authorName ||
    commit.committerTimestamp !== commit.timestamp;

  const { data: fullMessage } = useCommitMessage(repoPath, commit.id);
  const body = (() => {
    if (!fullMessage) return "";
    const idx = fullMessage.indexOf("\n");
    if (idx === -1) return "";
    return fullMessage
      .slice(idx + 1)
      .replace(/^\n+/, "")
      .trimEnd();
  })();
  const [copied, setCopied] = useState(false);

  const copySha = async () => {
    try {
      await navigator.clipboard.writeText(commit.id);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch (err) {
      toast.error(`Couldn't copy: ${(err as Error).message}`);
    }
  };

  return (
    <header className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-4">
      <div className="flex gap-3">
        <AuthorAvatar name={commit.authorName} email={commit.authorEmail} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-base font-medium leading-tight">{commit.summary}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span>
              <span className="font-medium text-foreground/80">{commit.authorName}</span>{" "}
              <span className="text-muted-foreground/70">&lt;{commit.authorEmail}&gt;</span>
            </span>
            <span aria-hidden>·</span>
            <time dateTime={authored.toISOString()} title={format(authored, "PPpp")}>
              {formatDistanceToNow(authored, { addSuffix: true })}
            </time>
            <span aria-hidden>·</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={copySha}
                  className="group inline-flex h-5 shrink-0 items-center gap-1 rounded border border-transparent bg-transparent px-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
                  aria-label="Copy full commit SHA"
                >
                  <span>{commit.shortId}</span>
                  {copied ? (
                    <Check className="h-3 w-3 text-foreground" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60 transition-opacity group-hover:opacity-100" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <span className="font-mono text-[11px]">{commit.id}</span>
              </TooltipContent>
            </Tooltip>
          </div>
          {differentCommitter && (
            <div className="mt-0.5 text-xs text-muted-foreground">
              committed by{" "}
              <span className="font-medium text-foreground/80">{commit.committerName}</span>{" "}
              <time dateTime={committed.toISOString()} title={format(committed, "PPpp")}>
                {formatDistanceToNow(committed, { addSuffix: true })}
              </time>
            </div>
          )}
        </div>
      </div>
      {body && <CommitBody key={commit.id} body={body} />}
    </header>
  );
}

const COLLAPSED_MAX_PX = 60;

function CommitBody({ body }: { body: string }) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [overflows, setOverflows] = useState(false);
  const [open, setOpen] = useState(false);
  const bodyId = useId();

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > COLLAPSED_MAX_PX + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ml-[calc(36px+0.75rem)] flex flex-col">
      <div className="relative">
        <div
          ref={measureRef}
          id={bodyId}
          className={cn(
            "whitespace-pre-wrap break-words text-xs leading-relaxed text-muted-foreground transition-[max-height] duration-150",
            open ? undefined : "overflow-hidden",
          )}
          style={open ? undefined : { maxHeight: COLLAPSED_MAX_PX }}
        >
          {body}
        </div>
        {!open && overflows && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-muted/30 to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="mt-1.5 w-fit text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ChangeStatus }) {
  let letter = "M";
  let label = "Modified";
  let tone = "bg-amber-500/15 text-amber-600 dark:text-amber-400";
  switch (status) {
    case "added":
      letter = "A";
      label = "Added";
      tone = "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
      break;
    case "deleted":
      letter = "D";
      label = "Deleted";
      tone = "bg-rose-500/15 text-rose-600 dark:text-rose-400";
      break;
    case "renamed":
      letter = "R";
      label = "Renamed";
      tone = "bg-sky-500/15 text-sky-600 dark:text-sky-400";
      break;
    case "copied":
      letter = "C";
      label = "Copied";
      tone = "bg-violet-500/15 text-violet-600 dark:text-violet-400";
      break;
  }
  return (
    <span
      className={cn(
        "ml-1 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[10px] font-bold",
        tone,
      )}
      role="img"
      aria-label={label}
      title={label}
    >
      <span aria-hidden>{letter}</span>
    </span>
  );
}
