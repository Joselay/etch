import { FileMinus, FilePen, FilePlus, FileSymlink } from "lucide-react";
import { useEffect } from "react";
import { Empty, EmptyDescription, EmptyHeader } from "@/components/ui/empty";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ChangeStatus } from "@/lib/tauri";
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
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyDescription>Select a commit to see its changes.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full">
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
          <DiffViewer repoPath={repoPath} commitId={selectedCommitId} filePath={selectedFilePath} />
        )}
      </section>
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
