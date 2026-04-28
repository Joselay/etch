import {
  AlertTriangle,
  Check,
  ChevronDown,
  FolderGit2,
  FolderOpen,
  FolderPlus,
  GitBranch,
  GitFork,
  History,
  Pencil,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProviderIcon } from "@/components/provider-icon";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { dispatchMenuEvent, onMenuEvent } from "@/lib/menu-events";
import { detectRemoteProvider } from "@/lib/remote-provider";
import { cn } from "@/lib/utils";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";
import { type RepoView, useSelectionStore, useTabSelection } from "@/stores/selection-store";
import { useCheckout } from "../hooks/use-branch-mutations";
import { useOpenRepo } from "../hooks/use-open-repo";
import { useRefs } from "../hooks/use-refs";
import { useRemoteAuthorsContextValue } from "../hooks/use-remote-authors";
import { useRemotes } from "../hooks/use-remotes";
import { RepoWatcher } from "../hooks/use-repo-watcher";
import { useStatus } from "../hooks/use-status";
import { RemoteAuthorsContext } from "../remote-authors-context";
import { ChangesView } from "./changes-view";
import { CommandPalette } from "./command-palette";
import { CommitDetails } from "./commit-details";
import { CommitList } from "./commit-list";
import { ReflogView } from "./reflog-view";
import { RefsSidebar } from "./refs-sidebar";
import { RemoteActions } from "./remote-actions";
import { RepoStateBanner } from "./repo-state-banner";
import { StatusBar } from "./status-bar";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoLayout() {
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const openRepos = useRepoStore((s) => s.openRepos);
  const welcomeTabOpen = useRepoStore((s) => s.welcomeTabOpen);
  const setActivePath = useRepoStore((s) => s.setActivePath);
  const clearActive = useRepoStore((s) => s.clearActive);
  const recentRepos = useRepoStore((s) => s.recentRepos);
  const remoteUrls = useRepoStore((s) => s.remoteUrls);
  const ensureTab = useSelectionStore((s) => s.ensureTab);
  const setViewFn = useSelectionStore((s) => s.setView);
  const { view } = useTabSelection(activeRepo?.path ?? null);
  const setView = (v: RepoView) => {
    if (activeRepo) setViewFn(activeRepo.path, v);
  };

  useEffect(() => {
    if (activeRepo) ensureTab(activeRepo.path);
  }, [activeRepo, ensureTab]);
  const { data: status } = useStatus(activeRepo?.path ?? null);
  const { data: refs } = useRefs(activeRepo?.path ?? null);
  const { data: remotes } = useRemotes(activeRepo?.path ?? null);
  const remoteAuthorsValue = useRemoteAuthorsContextValue(activeRepo?.path ?? null);
  const openSettings = useModalStore((s) => s.openSettings);
  const { openAt } = useOpenRepo();
  const checkout = useCheckout(activeRepo?.path ?? "");
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const confirmCloseActionRef = useRef<HTMLButtonElement>(null);
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);

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
  const primaryRemoteUrl = (remotes?.find((r) => r.name === "origin") ?? remotes?.[0])?.url ?? null;
  const headerProvider = primaryRemoteUrl ? detectRemoteProvider(primaryRemoteUrl) : null;
  const branchLabel = refs
    ? refs.isDetached
      ? `detached @ ${refs.headCommitId?.slice(0, 7) ?? "?"}`
      : (refs.headRef?.replace(/^refs\/heads\//, "") ?? "unborn")
    : activeRepo.isDetached
      ? `detached @ ${activeRepo.headCommitId?.slice(0, 7) ?? "?"}`
      : (activeRepo.headRef?.replace(/^refs\/heads\//, "") ?? "unborn");

  const requestClose = () => {
    if (hasDirtyRef.current) setConfirmCloseOpen(true);
    else void clearActive();
  };

  const openOrSwitch = (path: string) => {
    if (openRepos.some((r) => r.path === path)) setActivePath(path);
    else void openAt(path);
  };

  const otherRecents = recentRepos.filter(
    (r) => r.path !== activeRepo.path && !openRepos.some((o) => o.path === r.path),
  );

  return (
    <RemoteAuthorsContext.Provider value={remoteAuthorsValue}>
      {openRepos.map((r) => (
        <RepoWatcher key={r.path} path={r.path} />
      ))}
      <CommandPalette />
      <Tabs
        value={view}
        onValueChange={(v) => setView(v as RepoView)}
        className="flex h-full min-h-0 flex-1 flex-col gap-0 bg-background text-foreground"
      >
        <ResizablePanelGroup id="etch:repo-outer:v4" orientation="horizontal" className="flex-1">
          <ResizablePanel id="etch:refs-sidebar:v2" defaultSize="16%" minSize="14%" maxSize="22%">
            <aside className="flex h-full flex-col border-r border-border/60">
              <div
                data-tauri-drag-region
                aria-hidden
                className={cn(
                  "h-12 shrink-0",
                  isMac && openRepos.length <= 1 && !welcomeTabOpen && "pl-[78px]",
                )}
              />
              <div className="min-h-0 flex-1 overflow-hidden">
                <RefsSidebar repoPath={activeRepo.path} />
              </div>
            </aside>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="etch:main:v2" defaultSize="84%" minSize="40%">
            <div className="flex h-full flex-col">
              <header
                data-tauri-drag-region
                className="flex h-12 shrink-0 items-center justify-between gap-3 px-4"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label="Switch repository"
                      className="group -mx-1.5 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 outline-none transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent"
                    >
                      {headerProvider && headerProvider.kind !== "unknown" ? (
                        <ProviderIcon url={primaryRemoteUrl} className="h-4 w-4" />
                      ) : (
                        <FolderGit2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="truncate font-semibold">{name}</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-64">
                      {otherRecents.length > 0 ? (
                        <>
                          <DropdownMenuLabel>Recent repositories</DropdownMenuLabel>
                          {otherRecents.map((r) => {
                            const folder = r.path.split(/[\\/]/).filter(Boolean).pop() ?? r.path;
                            const url = r.remoteUrl ?? remoteUrls[r.path];
                            const known = !!url && detectRemoteProvider(url).kind !== "unknown";
                            return (
                              <DropdownMenuItem
                                key={r.path}
                                onSelect={() => openOrSwitch(r.path)}
                                title={r.path}
                              >
                                {known ? (
                                  <ProviderIcon url={url} className="h-4 w-4" />
                                ) : (
                                  <FolderGit2 className="text-muted-foreground" />
                                )}
                                <span className="truncate">{folder}</span>
                              </DropdownMenuItem>
                            );
                          })}
                          <DropdownMenuSeparator />
                        </>
                      ) : null}
                      <DropdownMenuItem onSelect={() => dispatchMenuEvent("open-repo")}>
                        <FolderOpen />
                        Open repository…
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => dispatchMenuEvent("clone-repo")}>
                        <GitFork />
                        Clone repository…
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => dispatchMenuEvent("new-repo")}>
                        <FolderPlus />
                        New repository…
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={requestClose}>
                        <X />
                        Close repository
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Popover open={branchPickerOpen} onOpenChange={setBranchPickerOpen}>
                    <PopoverTrigger
                      aria-label="Switch branch"
                      title={branchLabel}
                      className="group -mx-1 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-sm text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-accent data-[state=open]:text-foreground"
                    >
                      <GitBranch className="h-3.5 w-3.5 shrink-0" />
                      <span className="max-w-[24ch] truncate">{branchLabel}</span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform group-data-[state=open]:rotate-180" />
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-72 p-0">
                      <Command>
                        <CommandInput placeholder="Switch branch…" />
                        <CommandList>
                          <CommandEmpty>No branches.</CommandEmpty>
                          {(() => {
                            const locals = refs?.local ?? [];
                            const current = locals.find((b) => b.isHead);
                            const others = locals.filter((b) => !b.isHead);
                            return (
                              <>
                                {current ? (
                                  <CommandGroup heading="Current">
                                    <CommandItem
                                      key={current.fullName}
                                      value={current.name}
                                      onSelect={() => setBranchPickerOpen(false)}
                                      className="font-medium"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      <span className="truncate">{current.name}</span>
                                    </CommandItem>
                                  </CommandGroup>
                                ) : null}
                                {others.length > 0 ? (
                                  <>
                                    {current ? <CommandSeparator /> : null}
                                    <CommandGroup heading="Switch to">
                                      {others.map((b) => (
                                        <CommandItem
                                          key={b.fullName}
                                          value={b.name}
                                          onSelect={() => {
                                            setBranchPickerOpen(false);
                                            checkout.mutate({ target: b.name });
                                          }}
                                        >
                                          <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
                                          <span className="truncate">{b.name}</span>
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </>
                                ) : null}
                              </>
                            );
                          })()}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <RemoteActions repoPath={activeRepo.path} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={openSettings}
                        aria-label="Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Settings</TooltipContent>
                  </Tooltip>
                </div>
              </header>

              <RepoStateBanner repoPath={activeRepo.path} />

              <TabsContent value="history" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ResizablePanelGroup
                  id="etch:repo-history:v7"
                  orientation="vertical"
                  className="h-full"
                >
                  <ResizablePanel id="etch:commit-list" defaultSize="45%" minSize="25%">
                    <CommitList repoPath={activeRepo.path} />
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

              <TabsContent value="reflog" className="m-0 min-h-0 flex-1 overflow-hidden">
                <ReflogView repoPath={activeRepo.path} />
              </TabsContent>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
        <StatusBar />
      </Tabs>
      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            confirmCloseActionRef.current?.focus();
          }}
        >
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
            <AlertDialogAction ref={confirmCloseActionRef} onClick={() => void clearActive()}>
              Close anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RemoteAuthorsContext.Provider>
  );
}
