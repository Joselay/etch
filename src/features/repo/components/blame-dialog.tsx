import { formatDistanceToNow } from "date-fns";
import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { BlameLine } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useBlame } from "../hooks/use-file-history";

type Props = {
  repoPath: string;
  file: string | null;
  rev?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

// Color commits consistently by hashing the SHA into a hue.
function hueFromSha(sha: string): number {
  let h = 0;
  for (let i = 0; i < Math.min(8, sha.length); i++) h = (h * 31 + sha.charCodeAt(i)) & 0xffff;
  return h % 360;
}

export function BlameDialog({ repoPath, file, rev = null, open, onOpenChange }: Props) {
  const { data, isLoading, error } = useBlame(repoPath, file, rev);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[80vh] max-w-6xl gap-0 p-0 sm:max-w-6xl">
        <DialogHeader className="border-b px-4 py-3">
          <DialogTitle className="truncate">Blame — {file}</DialogTitle>
          <DialogDescription>
            {rev ? (
              <>
                At <code className="text-xs">{rev}</code>
              </>
            ) : (
              "At current HEAD"
            )}
          </DialogDescription>
        </DialogHeader>
        <Body file={file} data={data} isLoading={isLoading} error={error} />
      </DialogContent>
    </Dialog>
  );
}

function Body({
  file,
  data,
  isLoading,
  error,
}: {
  file: string | null;
  data: BlameLine[] | undefined;
  isLoading: boolean;
  error: unknown;
}) {
  if (!file) return null;
  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-2 p-4">
        {["a", "b", "c", "d", "e"].map((k) => (
          <Skeleton key={k} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="p-4 text-destructive text-sm">{(error as Error).message}</div>;
  }
  if (!data || data.length === 0) {
    return <div className="p-6 text-muted-foreground text-sm">No blame data.</div>;
  }
  return <BlameContent lines={data} />;
}

function BlameContent({ lines }: { lines: BlameLine[] }) {
  // Group runs of consecutive lines from the same commit so we only render
  // the gutter metadata once per block (GitHub-style).
  const blocks = useMemo(() => {
    const out: { sha: string; lines: BlameLine[] }[] = [];
    for (const l of lines) {
      const last = out[out.length - 1];
      if (last && last.sha === l.commitId) last.lines.push(l);
      else out.push({ sha: l.commitId, lines: [l] });
    }
    return out;
  }, [lines]);

  return (
    <ScrollArea className="h-full">
      <div className="font-mono text-[12px] leading-5">
        {blocks.map((b) => {
          const head = b.lines[0];
          const hue = hueFromSha(b.sha);
          return (
            <div key={`${b.sha}-${head.lineNo}`} className="flex border-border/40 border-b">
              <div
                className="flex w-64 shrink-0 flex-col gap-0.5 px-3 py-1 text-[11px]"
                style={{
                  backgroundColor: `hsl(${hue} 70% 50% / 0.08)`,
                  borderLeft: `3px solid hsl(${hue} 70% 50% / 0.7)`,
                }}
                title={`${head.summary}\n${head.authorName} <${head.authorEmail}>`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <code className="shrink-0">{head.shortId}</code>
                  <span className="truncate text-muted-foreground">
                    {head.authorTime > 0
                      ? formatDistanceToNow(new Date(head.authorTime * 1000), { addSuffix: true })
                      : ""}
                  </span>
                </div>
                <div className="truncate text-muted-foreground">{head.authorName}</div>
              </div>
              <div className="min-w-0 flex-1">
                {b.lines.map((l) => (
                  <div
                    key={l.lineNo}
                    className={cn("flex items-baseline gap-2 px-2", "hover:bg-muted/40")}
                  >
                    <span className="w-10 shrink-0 select-none text-right text-muted-foreground/70">
                      {l.lineNo}
                    </span>
                    <span className="whitespace-pre">{l.content}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
