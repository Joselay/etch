import { FolderGit2, History, PanelLeft, Pencil, Settings, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRepoStore } from "@/stores/repo-store";
import { type RepoView, useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useRemoteAuthorsContextValue } from "../hooks/use-remote-authors";
import { useRepoWatcher } from "../hooks/use-repo-watcher";
import { useStatus } from "../hooks/use-status";
import { RemoteAuthorsContext } from "../remote-authors-context";
import { BranchSwitcher } from "./branch-switcher";
import { ChangesView } from "./changes-view";
import { CommandPalette } from "./command-palette";
import { CommitDetails } from "./commit-details";
import { CommitList } from "./commit-list";
import { RefsSidebar } from "./refs-sidebar";
import { RemoteActions } from "./remote-actions";

export function RepoLayout() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const clearActive = useRepoStore((s) => s.clearActive);
  const view = useSelectionStore((s) => s.view);
  const setView = useSelectionStore((s) => s.setView);

  useRepoWatcher(activeRepo?.path ?? null);
  const { data: status } = useStatus(activeRepo?.path ?? null);
  const remoteAuthorsValue = useRemoteAuthorsContextValue(activeRepo?.path ?? null);
  const openSettings = useUiStore((s) => s.openSettings);
  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  if (!activeRepo) return null;

  const name = activeRepo.path.split(/[\\/]/).filter(Boolean).pop() ?? activeRepo.path;
  const branchLabel = activeRepo.isDetached
    ? `detached @ ${activeRepo.headCommitId?.slice(0, 7) ?? "?"}`
    : (activeRepo.headRef?.replace(/^refs\/heads\//, "") ?? "unborn");

  const dirtyCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);

  return (
    <RemoteAuthorsContext.Provider value={remoteAuthorsValue}>
      <CommandPalette />
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as RepoView)}
        className="flex h-screen flex-col gap-0 bg-background text-foreground"
      >
        <header className="flex items-center justify-between gap-3 border-b px-4 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              size="icon"
              variant="ghost"
              onClick={toggleSidebar}
              aria-label={sidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
            <FolderGit2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate font-semibold">{name}</span>
            <BranchSwitcher repoPath={activeRepo.path} label={branchLabel} />
            <RemoteActions repoPath={activeRepo.path} />
          </div>
          <div className="flex items-center gap-2">
            <TabsList>
              <TabsTrigger value="history">
                <History className="h-3.5 w-3.5" />
                History
              </TabsTrigger>
              <TabsTrigger value="changes">
                <Pencil className="h-3.5 w-3.5" />
                Changes
                {dirtyCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {dirtyCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <Button size="icon" variant="ghost" onClick={openSettings} aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={clearActive}>
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </header>

        <TabsContent value="history" className="m-0 flex-1 overflow-hidden">
          <ResizablePanelGroup id="loom:repo-outer:v3" orientation="horizontal" className="h-full">
            {!sidebarCollapsed && (
              <ResizablePanel id="loom:refs-sidebar" defaultSize="16%" minSize="10%" maxSize="22%">
                <aside className="h-full overflow-hidden border-r">
                  <RefsSidebar repoPath={activeRepo.path} />
                </aside>
              </ResizablePanel>
            )}
            {!sidebarCollapsed && <ResizableHandle withHandle />}
            <ResizablePanel id="loom:main-history" defaultSize="84%" minSize="40%">
              <ResizablePanelGroup
                id="loom:repo-history:v3"
                orientation="vertical"
                className="h-full"
              >
                <ResizablePanel id="loom:commit-list" defaultSize="28%" minSize="15%">
                  <CommitList repoPath={activeRepo.path} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="loom:commit-details" defaultSize="72%" minSize="25%">
                  <CommitDetails repoPath={activeRepo.path} />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="changes" className="m-0 flex-1 overflow-hidden">
          <ResizablePanelGroup
            id="loom:repo-outer-changes:v3"
            orientation="horizontal"
            className="h-full"
          >
            {!sidebarCollapsed && (
              <ResizablePanel
                id="loom:refs-sidebar-changes"
                defaultSize="16%"
                minSize="10%"
                maxSize="22%"
              >
                <aside className="h-full overflow-hidden border-r">
                  <RefsSidebar repoPath={activeRepo.path} />
                </aside>
              </ResizablePanel>
            )}
            {!sidebarCollapsed && <ResizableHandle withHandle />}
            <ResizablePanel id="loom:main-changes" defaultSize="84%" minSize="40%">
              <ChangesView repoPath={activeRepo.path} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>
      </Tabs>
    </RemoteAuthorsContext.Provider>
  );
}
