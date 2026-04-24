import type { FileDiff } from "@/lib/tauri";
import { useFileDiff } from "../hooks/use-commit-details";

type Props =
  | { repoPath: string; commitId: string; filePath: string; data?: undefined; inline?: undefined }
  | {
      data: FileDiff;
      inline?: boolean;
      repoPath?: undefined;
      commitId?: undefined;
      filePath?: undefined;
    };

export function DiffViewer(props: Props) {
  if ("data" in props && props.data) {
    return <DiffBody data={props.data} />;
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

function DiffBody({ data }: { data: FileDiff }) {
  if (data.isBinary) {
    return <div className="p-4 text-xs text-muted-foreground">Binary file not shown.</div>;
  }
  if (data.hunks.length === 0) {
    return <div className="p-4 text-xs text-muted-foreground">No textual changes.</div>;
  }
  return (
    <div className="h-full overflow-auto font-mono text-[12px] leading-5">
      {data.hunks.map((hunk, hi) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: diff hunks are immutable for a given file/commit
        <div key={hi} className="border-b border-border/50">
          <div className="bg-muted/60 px-3 py-1 text-muted-foreground">{hunk.header}</div>
          <div>
            {hunk.lines.map((line, li) => {
              const bg =
                line.kind === "addition"
                  ? "bg-emerald-500/10"
                  : line.kind === "deletion"
                    ? "bg-rose-500/10"
                    : "";
              const marker = line.kind === "addition" ? "+" : line.kind === "deletion" ? "-" : " ";
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: diff lines are immutable for a given file/commit
                <div key={li} className={`flex ${bg}`}>
                  <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70">
                    {line.oldLine ?? ""}
                  </span>
                  <span className="w-10 shrink-0 select-none px-2 text-right text-muted-foreground/70">
                    {line.newLine ?? ""}
                  </span>
                  <span className="w-4 shrink-0 select-none text-muted-foreground/80">
                    {marker}
                  </span>
                  <span className="flex-1 whitespace-pre-wrap break-all px-2">
                    {line.content || " "}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
