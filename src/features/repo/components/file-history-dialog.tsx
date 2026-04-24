import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useFileHistory } from "../hooks/use-file-history";
import { AuthorAvatar } from "./author-avatar";
import { DiffViewer } from "./diff-viewer";

type Props = {
  repoPath: string;
  file: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function FileHistoryDialog({ repoPath, file, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useFileHistory(repoPath, file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80vh] max-w-5xl gap-0 p-0 sm:max-w-5xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="truncate">History — {file}</DialogTitle>
          <DialogDescription className="truncate">
            Commits that touched this file (rename-following).
          </DialogDescription>
        </DialogHeader>
        <Body repoPath={repoPath} file={file} data={data} isLoading={isLoading} error={error} />
      </DialogContent>
    </Dialog>
  );
}

function Body({
  repoPath,
  file,
  data,
  isLoading,
  error,
}: {
  repoPath: string;
  file: string | null;
  data: CommitSummary[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (!file) return null;
  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {["a", "b", "c"].map((k) => (
          <Skeleton key={k} className="h-12 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-destructive text-sm">{(error as Error).message}</div>;
  }
  if (!data || data.length === 0) {
    return <div className="p-6 text-muted-foreground text-sm">No commits touched this file.</div>;
  }
  return <HistoryContent repoPath={repoPath} file={file} commits={data} />;
}

function HistoryContent({
  repoPath,
  file,
  commits,
}: {
  repoPath: string;
  file: string;
  commits: CommitSummary[];
}) {
  // Track selection locally; default to most recent commit.
  const [selected, setSelected] = useSelected(commits);
  return (
    <div className="grid min-h-0 flex-1 grid-cols-[22rem_1fr]">
      <ScrollArea className="border-r">
        <ul className="flex flex-col">
          {commits.map((c) => {
            const active = c.id === selected;
            return (
              <li key={c.id}>
                <Button
                  variant="ghost"
                  className={cn(
                    "h-auto w-full justify-start rounded-none border-b border-border/50 px-3 py-2 text-left",
                    active && "bg-primary/10",
                  )}
                  onClick={() => setSelected(c.id)}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <AuthorAvatar name={c.authorName} email={c.authorEmail} size={24} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{c.summary}</div>
                      <div className="truncate text-muted-foreground text-xs">
                        <code className="mr-2 font-mono">{c.shortId}</code>
                        {c.authorName} ·{" "}
                        {formatDistanceToNow(new Date(c.timestamp * 1000), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                </Button>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
      <div className="min-h-0 overflow-hidden">
        {selected && <DiffViewer repoPath={repoPath} commitId={selected} filePath={file} />}
      </div>
    </div>
  );
}

// Tiny util so we don't accidentally forget to reset selection when the
// commit list changes under us.
import { useEffect, useState } from "react";

function useSelected(commits: CommitSummary[]): [string | null, (id: string) => void] {
  const [selected, setSelected] = useState<string | null>(commits[0]?.id ?? null);
  useEffect(() => {
    // If the current selection is no longer in the list, fall back to the newest.
    if (!commits.some((c) => c.id === selected)) {
      setSelected(commits[0]?.id ?? null);
    }
  }, [commits, selected]);
  return [selected, setSelected];
}
