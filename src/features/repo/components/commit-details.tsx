import { FileMinus, FilePen, FilePlus, FileSymlink } from "lucide-react";
import { useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangeStatus } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommitChanges } from "../hooks/use-commit-details";
import { DiffViewer } from "./diff-viewer";

type Props = { repoPath: string };

export function CommitDetails({ repoPath }: Props) {
  const selectedCommitId = useSelectionStore((s) => s.selectedCommitId);
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
      <div className="grid h-full place-items-center p-4 text-xs text-muted-foreground">
        Select a commit to see its changes.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex min-h-0 flex-1">
        <aside className="w-64 shrink-0 overflow-auto border-r text-sm">
          {isLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-6 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="p-3 text-xs text-destructive">{(error as Error).message}</div>
          ) : data && data.length > 0 ? (
            <ul>
              {data.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    onClick={() => selectFile(f.path)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left",
                      selectedFilePath === f.path ? "bg-primary/10" : "hover:bg-muted/40",
                    )}
                  >
                    <StatusIcon status={f.status} />
                    <span className="min-w-0 flex-1 truncate text-xs">{f.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="p-3 text-xs text-muted-foreground">No file changes.</div>
          )}
        </aside>
        <section className="min-w-0 flex-1">
          {selectedFilePath && (
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
