import { AlertTriangle, FolderGit2, GitBranch, History, Pencil, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { onMenuEvent } from "@/lib/menu-events";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { type RepoView, useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useRefs } from "../hooks/use-refs";
import { useRemoteAuthorsContextValue } from "../hooks/use-remote-authors";
import { useRepoWatcher } from "../hooks/use-repo-watcher";
import { useStatus } from "../hooks/use-status";
import { RemoteAuthorsContext } from "../remote-authors-context";
import { ChangesView } from "./changes-view";
import { CommandPalette } from "./command-palette";
import { CommitDetails } from "./commit-details";
import { CommitList } from "./commit-list";
import { RefsSidebar } from "./refs-sidebar";
import { RemoteActions } from "./remote-actions";
import { RepoStateBanner } from "./repo-state-banner";
import { StatusBar } from "./status-bar";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoLayout() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const clearActive = useRepoStore((s) => s.clearActive);
  const view = useSelectionStore((s) => s.view);
  const setView = useSelectionStore((s) => s.setView);

  useRepoWatcher(activeRepo?.path ?? null);
  const { data: status } = useStatus(activeRepo?.path ?? null);
  const { data: refs } = useRefs(activeRepo?.path ?? null);
  const remoteAuthorsValue = useRemoteAuthorsContextValue(activeRepo?.path ?? null);
  const openSettings = useUiStore((s) => s.openSettings);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const dirtyCount =
    (status?.staged.length ?? 0) + (status?.unstaged.length ?? 0) + (status?.untracked.length ?? 0);
  const conflictCount = status?.conflicted.length ?? 0;
  const hasDirty = dirtyCount > 0 || conflictCount > 0;
  const hasDirtyRef = useRef(hasDirty);
  hasDirtyRef.current = hasDirty;

  useEffect(() => {
    return onMenuEvent("close-repo", () => {
      if (hasDirtyRef.current) setConfirmCloseOpen(true);
      else clearActive();
    });
  }, [clearActive]);

  if (!activeRepo) return null;

  const name = activeRepo.path.split(/[\\/]/).filter(Boolean).pop() ?? activeRepo.path;
  const branchLabel = refs
    ? refs.isDetached
      ? `detached @ ${refs.headCommitId?.slice(0, 7) ?? "?"}`
      : (refs.headRef?.replace(/^refs\/heads\//, "") ?? "unborn")
    : activeRepo.isDetached
      ? `detached @ ${activeRepo.headCommitId?.slice(0, 7) ?? "?"}`
      : (activeRepo.headRef?.replace(/^refs\/heads\//, "") ?? "unborn");

  const requestClose = () => {
    if (hasDirtyRef.current) setConfirmCloseOpen(true);
    else clearActive();
  };

  return (
    <RemoteAuthorsContext.Provider value={remoteAuthorsValue}>
      <CommandPalette />
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as RepoView)}
        className="flex h-screen flex-col gap-0 bg-background text-foreground"
      >
        <header
          data-tauri-drag-region
          className={cn(
            "flex items-center justify-between gap-3 border-b px-4 py-2",
            isMac && "pl-[78px]",
          )}
        >
          <div data-tauri-drag-region className="flex min-w-0 items-center gap-3">
            <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-semibold">{name}</span>
            <span
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
              title={branchLabel}
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span className="max-w-[24ch] truncate">{branchLabel}</span>
            </span>
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
                {conflictCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="ml-1 h-5 gap-1 px-1.5 text-[10px]"
                    aria-label={`${dirtyCount} changes, ${conflictCount} conflicts`}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {dirtyCount}
                  </Badge>
                ) : dirtyCount > 0 ? (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {dirtyCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" onClick={openSettings} aria-label="Settings">
                  <Settings className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Settings</TooltipContent>
            </Tooltip>
            <Button size="sm" variant="ghost" onClick={requestClose} aria-label="Close repository">
              <X className="h-4 w-4" />
              Close
            </Button>
          </div>
        </header>

        <RepoStateBanner repoPath={activeRepo.path} />

        <TabsContent value="history" className="m-0 flex-1 overflow-hidden">
          <ResizablePanelGroup id="loom:repo-outer:v3" orientation="horizontal" className="h-full">
            <ResizablePanel id="loom:refs-sidebar" defaultSize="16%" minSize="10%" maxSize="22%">
              <aside className="h-full overflow-hidden border-r">
                <RefsSidebar repoPath={activeRepo.path} />
              </aside>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="loom:main-history" defaultSize="84%" minSize="40%">
              <ResizablePanelGroup
                id="loom:repo-history:v7"
                orientation="vertical"
                className="h-full"
              >
                <ResizablePanel id="loom:commit-list" defaultSize="45%" minSize="25%">
                  <CommitList repoPath={activeRepo.path} />
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel id="loom:commit-details" defaultSize="55%" minSize="30%">
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
            <ResizableHandle withHandle />
            <ResizablePanel id="loom:main-changes" defaultSize="84%" minSize="40%">
              <ChangesView repoPath={activeRepo.path} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>
        <StatusBar />
      </Tabs>
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close repository with uncommitted changes?</AlertDialogTitle>
            <AlertDialogDescription>
              {conflictCount > 0
                ? `${conflictCount} conflicted file${conflictCount === 1 ? "" : "s"} and `
                : ""}
              {dirtyCount} working-tree change{dirtyCount === 1 ? "" : "s"} will remain in the
              repository. Closing only removes it from this window.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep open</AlertDialogCancel>
            <AlertDialogAction onClick={() => clearActive()}>Close anyway</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RemoteAuthorsContext.Provider>
  );
}
