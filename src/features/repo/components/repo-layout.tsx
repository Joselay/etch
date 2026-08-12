import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  FolderGit2,
  FolderOpen,
  GitBranch,
  History,
  Pencil,
  RefreshCw,
  X,
} from "lucide-react";
import { useEffect } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dispatchMenuEvent } from "@/lib/menu-events";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { type RepoView, useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useOpenRepo } from "../hooks/use-open-repo";
import { RepoWatcher } from "../hooks/use-repo-watcher";
import { useStatus } from "../hooks/use-status";
import { ChangesView } from "./changes-view";
import { CommitDetails } from "./commit-details";
import { CommitList } from "./commit-list";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoLayout() {
  const queryClient = useQueryClient();
  const activeRepo = useRepoStore((state) => state.activeRepo);
  const openRepos = useRepoStore((state) => state.openRepos);
  const welcomeTabOpen = useRepoStore((state) => state.welcomeTabOpen);
  const recentRepos = useRepoStore((state) => state.recentRepos);
  const setActivePath = useRepoStore((state) => state.setActivePath);
  const clearActive = useRepoStore((state) => state.clearActive);
  const ensureTab = useSelectionStore((state) => state.ensureTab);
  const setView = useSelectionStore((state) => state.setView);
  const { view } = useTabSelection(activeRepo?.path ?? null);
  const { openAt } = useOpenRepo();
  const { data: status } = useStatus(activeRepo?.path ?? null);

  useEffect(() => {
    if (activeRepo) ensureTab(activeRepo.path);
  }, [activeRepo, ensureTab]);

  if (!activeRepo) return null;

  const name = activeRepo.path.split(/[\\/]/).filter(Boolean).pop() ?? activeRepo.path;
  const branchLabel = activeRepo.isDetached
    ? `detached @ ${activeRepo.headCommitId?.slice(0, 7) ?? "?"}`
    : (activeRepo.headRef?.replace(/^refs\/heads\//, "") ?? "no commits");
  const dirtyCount =
    (status?.staged.length ?? 0) +
    (status?.unstaged.length ?? 0) +
    (status?.untracked.length ?? 0) +
    (status?.conflicted.length ?? 0);
  const otherRecents = recentRepos.filter(
    (repo) =>
      repo.path !== activeRepo.path && !openRepos.some((openRepo) => openRepo.path === repo.path),
  );

  const openOrSwitch = (path: string) => {
    if (openRepos.some((repo) => repo.path === path)) void setActivePath(path);
    else void openAt(path);
  };

  return (
    <>
      <RepoWatcher />
      <Tabs
        value={view}
        onValueChange={(next) => setView(activeRepo.path, next as RepoView)}
        className="flex h-full min-h-0 flex-1 flex-col gap-0 bg-background text-foreground"
      >
        <header
          data-tauri-drag-region
          className={cn(
            "flex h-12 shrink-0 items-center justify-between gap-3 border-b px-4",
            isMac && openRepos.length <= 1 && !welcomeTabOpen && "pl-[86px]",
          )}
        >
          <div className="flex min-w-0 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger className="group flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-semibold">{name}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-72">
                {otherRecents.length > 0 && (
                  <>
                    <DropdownMenuLabel>Recent repositories</DropdownMenuLabel>
                    {otherRecents.map((repo) => (
                      <DropdownMenuItem
                        key={repo.path}
                        onSelect={() => openOrSwitch(repo.path)}
                        title={repo.path}
                      >
                        <FolderGit2 />
                        <span className="truncate">
                          {repo.path.split(/[\\/]/).filter(Boolean).pop() ?? repo.path}
                        </span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={() => dispatchMenuEvent("open-repo")}>
                  <FolderOpen />
                  Open local repository…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => void clearActive()}>
                  <X />
                  Close repository
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span
              className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
              title={branchLabel}
            >
              <GitBranch className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[24ch] truncate">{branchLabel}</span>
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <TabsList>
              <TabsTrigger value="history">
                <History />
                History
              </TabsTrigger>
              <TabsTrigger value="changes">
                <Pencil />
                Changes
                {dirtyCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {dirtyCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Refresh repository"
                  onClick={() => void queryClient.invalidateQueries()}
                >
                  <RefreshCw />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh repository</TooltipContent>
            </Tooltip>
            <ThemeToggle />
          </div>
        </header>

        <TabsContent value="history" className="m-0 min-h-0 flex-1 overflow-hidden">
          <ResizablePanelGroup id="etch:repo-history:readonly" orientation="vertical">
            <ResizablePanel id="etch:commit-list" defaultSize="45%" minSize="25%">
              <CommitList repoPath={activeRepo.path} headCommitId={activeRepo.headCommitId} />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="etch:commit-details" defaultSize="55%" minSize="30%">
              <CommitDetails repoPath={activeRepo.path} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </TabsContent>

        <TabsContent value="changes" className="m-0 min-h-0 flex-1 overflow-hidden">
          <ChangesView repoPath={activeRepo.path} />
        </TabsContent>
      </Tabs>
    </>
  );
}
