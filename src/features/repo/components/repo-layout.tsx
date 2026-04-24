import { FolderGit2, GitBranch, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useRepoStore } from "@/stores/repo-store";
import { CommitDetails } from "./commit-details";
import { CommitList } from "./commit-list";
import { RefsSidebar } from "./refs-sidebar";

export function RepoLayout() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const clearActive = useRepoStore((s) => s.clearActive);
  if (!activeRepo) return null;

  const name = activeRepo.path.split(/[\\/]/).filter(Boolean).pop() ?? activeRepo.path;
  const branchLabel = activeRepo.isDetached
    ? `detached @ ${activeRepo.headCommitId?.slice(0, 7) ?? "?"}`
    : (activeRepo.headRef?.replace(/^refs\/heads\//, "") ?? "unborn");

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <FolderGit2 className="h-4 w-4 text-muted-foreground" />
          <span className="truncate font-semibold">{name}</span>
          <span className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <GitBranch className="h-3 w-3" />
            {branchLabel}
          </span>
        </div>
        <Button size="sm" variant="ghost" onClick={clearActive}>
          <X className="h-4 w-4" />
          Close
        </Button>
      </header>
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel defaultSize={18} minSize={12}>
          <aside className="h-full overflow-hidden border-r">
            <RefsSidebar repoPath={activeRepo.path} />
          </aside>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={36} minSize={20}>
          <CommitList repoPath={activeRepo.path} />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={46} minSize={25}>
          <CommitDetails repoPath={activeRepo.path} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
