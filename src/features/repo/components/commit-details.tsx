import { format, formatDistanceToNow } from "date-fns";
import { Check, ChevronDown, ChevronUp, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FileIcon } from "@/components/file-icon";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChangeStatus, CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommitChanges, useCommitMessage } from "../hooks/use-commit-details";
import { AuthorAvatar } from "./author-avatar";
import { DiffViewer } from "./diff-viewer";
import { FileRowContextMenu } from "./file-row-context-menu";
import { FileTree, TreeIndentGuides, TreeLeafSpacer } from "./file-tree";

type Props = { repoPath: string };

export function CommitDetails({ repoPath }: Props) {
  const selectedCommitId = useSelectionStore((s) => s.selectedCommitId);
  const commit = useSelectionStore((s) => s.selectedCommit);
  const selectedFilePath = useSelectionStore((s) => s.selectedFilePath);
  const selectFile = useSelectionStore((s) => s.selectFile);
  const { data, isLoading, error } = useCommitChanges(repoPath, selectedCommitId);

  useEffect(() => {
    if (data && data.length > 0 && !selectedFilePath) {
      selectFile(data[0].path);
    }
  }, [data, selectedFilePath, selectFile]);

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
        id="loom:commit-details-inner:v1"
        orientation="horizontal"
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="loom:commit-files" defaultSize="28%" minSize="15%" maxSize="60%">
          <aside className="h-full overflow-hidden border-r">
            <div className="h-full overflow-y-auto">
              {isLoading ? (
                <div className="flex flex-col gap-1 p-2">
                  {["a", "b", "c", "d"].map((k) => (
                    <Skeleton key={k} className="h-6 w-full" />
                  ))}
                </div>
              ) : error ? (
                <div className="p-3 text-xs text-destructive">{(error as Error).message}</div>
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
                          onClick={() => selectFile(f.path)}
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
        <ResizablePanel id="loom:commit-diff" defaultSize="72%" minSize="30%">
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
  const [bodyOpen, setBodyOpen] = useState(false);
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
    <header className="flex flex-col gap-2 border-b bg-muted/30 px-4 py-3">
      <div className="flex gap-3">
        <AuthorAvatar name={commit.authorName} email={commit.authorEmail} size={36} />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium leading-tight">{commit.summary}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground/80">{commit.authorName}</span>{" "}
            <span>&lt;{commit.authorEmail}&gt;</span>
            {" · "}
            <time dateTime={authored.toISOString()} title={format(authored, "PPpp")}>
              {formatDistanceToNow(authored, { addSuffix: true })}
            </time>
          </div>
          {differentCommitter && (
            <div className="text-xs text-muted-foreground">
              committed by{" "}
              <span className="font-medium text-foreground/80">{commit.committerName}</span>{" "}
              <time dateTime={committed.toISOString()} title={format(committed, "PPpp")}>
                {formatDistanceToNow(committed, { addSuffix: true })}
              </time>
            </div>
          )}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={copySha}
              className="group inline-flex h-6 shrink-0 items-center gap-1.5 self-start rounded border border-transparent bg-transparent px-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-border hover:bg-background hover:text-foreground"
              aria-label="Copy full commit SHA"
            >
              <span>{commit.shortId}</span>
              {copied ? (
                <Check className="h-3 w-3 text-emerald-500" />
              ) : (
                <Copy className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <span className="font-mono text-[11px]">{commit.id}</span>
            <span className="ml-2 text-muted-foreground">click to copy</span>
          </TooltipContent>
        </Tooltip>
      </div>
      {body && (
        <div className="ml-[calc(36px+0.75rem)] flex flex-col gap-1">
          {bodyOpen ? (
            <pre className="m-0 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border bg-background/60 px-3 py-2 font-sans text-xs text-foreground/90">
              {body}
            </pre>
          ) : (
            <p className="line-clamp-2 text-xs text-muted-foreground">{body}</p>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-fit gap-1 px-1.5 text-[11px] text-muted-foreground"
            onClick={() => setBodyOpen((v) => !v)}
          >
            {bodyOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {bodyOpen ? "Hide message body" : "Show full message"}
          </Button>
        </div>
      )}
    </header>
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
