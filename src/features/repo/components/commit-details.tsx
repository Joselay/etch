import { format, formatDistanceToNow } from "date-fns";
import { FileMinus, FilePen, FilePlus, FileSymlink } from "lucide-react";
import { useEffect, useMemo } from "react";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangeStatus, CommitSummary } from "@/lib/tauri";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommitChanges } from "../hooks/use-commit-details";
import { useCommitLog } from "../hooks/use-commit-log";
import { AuthorAvatar } from "./author-avatar";
import { DiffViewer } from "./diff-viewer";

type Props = { repoPath: string };

export function CommitDetails({ repoPath }: Props) {
  const selectedCommitId = useSelectionStore((s) => s.selectedCommitId);
  const selectedFilePath = useSelectionStore((s) => s.selectedFilePath);
  const selectFile = useSelectionStore((s) => s.selectFile);
  const { data, isLoading, error } = useCommitChanges(repoPath, selectedCommitId);
  const { data: commits } = useCommitLog(repoPath);
  const commit = useMemo(
    () => commits?.find((c) => c.id === selectedCommitId) ?? null,
    [commits, selectedCommitId],
  );

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
      {commit && <CommitHeader commit={commit} />}
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 border-r">
          <ScrollArea className="h-full">
            {isLoading ? (
              <div className="flex flex-col gap-1 p-2">
                {["a", "b", "c", "d"].map((k) => (
                  <Skeleton key={k} className="h-6 w-full" />
                ))}
              </div>
            ) : error ? (
              <div className="p-3 text-xs text-destructive">{(error as Error).message}</div>
            ) : data && data.length > 0 ? (
              <ItemGroup>
                {data.map((f) => (
                  <Item
                    key={f.path}
                    size="sm"
                    variant="muted"
                    data-selected={selectedFilePath === f.path || undefined}
                    className="cursor-pointer rounded-none border-0 bg-transparent px-3 data-[selected]:bg-primary/10"
                    onClick={() => selectFile(f.path)}
                  >
                    <ItemMedia>
                      <StatusIcon status={f.status} />
                    </ItemMedia>
                    <ItemContent className="min-w-0">
                      <ItemTitle className="truncate text-xs font-normal">{f.path}</ItemTitle>
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            ) : (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyDescription>No file changes.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            )}
          </ScrollArea>
        </aside>
        <section className="min-w-0 flex-1">
          {selectedFilePath && selectedCommitId && (
            <DiffViewer
              repoPath={repoPath}
              commitId={selectedCommitId}
              filePath={selectedFilePath}
            />
          )}
        </section>
      </div>
    </div>
  );
}

function CommitHeader({ commit }: { commit: CommitSummary }) {
  const authored = new Date(commit.timestamp * 1000);
  const committed = new Date(commit.committerTimestamp * 1000);
  const differentCommitter =
    commit.committerEmail !== commit.authorEmail ||
    commit.committerName !== commit.authorName ||
    commit.committerTimestamp !== commit.timestamp;

  return (
    <header className="flex gap-3 border-b bg-muted/30 px-4 py-3">
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
      <code className="self-start font-mono text-xs text-muted-foreground">{commit.shortId}</code>
    </header>
  );
}

function StatusIcon({ status }: { status: ChangeStatus }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  switch (status) {
    case "added":
      return <FilePlus className={`${cls} text-emerald-500`} />;
    case "deleted":
      return <FileMinus className={`${cls} text-rose-500`} />;
    case "renamed":
    case "copied":
      return <FileSymlink className={`${cls} text-amber-500`} />;
    default:
      return <FilePen className={`${cls} text-muted-foreground`} />;
  }
}
