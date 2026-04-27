import {
  Archive,
  Check,
  ChevronRight,
  Cloud,
  GitBranch,
  History,
  Plus,
  Search,
  Settings2,
  Tag,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { onMenuEvent } from "@/lib/menu-events";
import type { CommitSummary } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useSelectionStore, useTabSelection } from "@/stores/selection-store";
import {
  useCheckout,
  useCheckoutTracking,
  useMerge,
  useStartRebase,
} from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { useRemotes } from "../hooks/use-remotes";
import { useApplyStash, useDropStash, usePopStash, useStashes } from "../hooks/use-stash";
import { useDeleteTag, usePushTag } from "../hooks/use-tag-mutations";
import { CreateBranchDialog } from "./create-branch-dialog";
import { DeleteBranchDialog } from "./delete-branch-dialog";
import { PrPanel } from "./pr-panel";
import { RebasePlannerDialog } from "./rebase-planner-dialog";
import { RemotesDialog } from "./remotes-dialog";
import { RenameBranchDialog } from "./rename-branch-dialog";
import { StashCreateDialog } from "./stash-create-dialog";
import { TagCreateDialog } from "./tag-create-dialog";

type Props = { repoPath: string };

type CreateState = { open: boolean; startPoint: string | null };
type BranchDialogState = { open: boolean; name: string };
type DeleteBranchState = { open: boolean; name: string; target: string | null };

export function RefsSidebar({ repoPath }: Props) {
  const { data, isLoading, error, refetch } = useRefs(repoPath);
  const checkout = useCheckout(repoPath);
  const checkoutTracking = useCheckoutTracking(repoPath);
  const selectCommitFn = useSelectionStore((s) => s.selectCommit);
  const setViewFn = useSelectionStore((s) => s.setView);
  const { view: currentView } = useTabSelection(repoPath);
  const selectCommit = (id: string | null, summary: CommitSummary | null = null) =>
    selectCommitFn(repoPath, id, summary);
  const setView = (v: "history" | "changes" | "reflog") => setViewFn(repoPath, v);

  const [createState, setCreateState] = useState<CreateState>({ open: false, startPoint: null });
  const [renameState, setRenameState] = useState<BranchDialogState>({ open: false, name: "" });
  const [deleteState, setDeleteState] = useState<DeleteBranchState>({
    open: false,
    name: "",
    target: null,
  });
  const [plannerState, setPlannerState] = useState<{ open: boolean; onto: string }>({
    open: false,
    onto: "",
  });
  const [stashOpen, setStashOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const remotes = useRemotes(repoPath);
  const stashes = useStashes(repoPath);
  const applyStash = useApplyStash(repoPath);
  const popStash = usePopStash(repoPath);
  const dropStash = useDropStash(repoPath);
  const merge = useMerge(repoPath);
  const startRebase = useStartRebase(repoPath);
  const deleteTag = useDeleteTag(repoPath);
  const pushTag = usePushTag(repoPath);
  const [tagDialog, setTagDialog] = useState<{
    open: boolean;
    target: string | null;
  }>({ open: false, target: null });

  const needle = filter.trim().toLowerCase();

  useEffect(() => {
    const offs = [
      onMenuEvent("new-branch", () => setCreateState({ open: true, startPoint: null })),
      onMenuEvent("create-stash", () => setStashOpen(true)),
      onMenuEvent("new-tag", () => setTagDialog({ open: true, target: null })),
    ];
    return () => {
      for (const off of offs) off();
    };
  }, []);

  const filteredStashes = useMemo(() => {
    const list = stashes.data ?? [];
    if (!needle) return list;
    return list.filter((s) => s.message.toLowerCase().includes(needle));
  }, [stashes.data, needle]);

  const localBranches = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.local;
    return data.local.filter((b) => b.name.toLowerCase().includes(needle));
  }, [data, needle]);
  const filteredTags = useMemo(() => {
    if (!data) return [];
    if (!needle) return data.tags;
    return data.tags.filter((t) => t.name.toLowerCase().includes(needle));
  }, [data, needle]);

  const remoteGroups = useMemo(() => {
    const map = new Map<
      string,
      { name: string; fullName: string; target: string | null; remote: string }[]
    >();
    if (!data) return map;
    for (const r of data.remote) {
      if (needle && !r.name.toLowerCase().includes(needle)) continue;
      const key = r.remote ?? "origin";
      const arr = map.get(key) ?? [];
      arr.push({ name: r.name, fullName: r.fullName, target: r.target, remote: key });
      map.set(key, arr);
    }
    return map;
  }, [data, needle]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {["s1", "s2", "s3", "s4"].map((k) => (
          <Skeleton key={k} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        error={error as Error}
        title="Couldn't load refs"
        onRetry={() => void refetch()}
        tone="compact"
      />
    );
  }

  if (!data) return null;

  const localBranchNames = new Set(data.local.map((b) => b.name));
  const hasAnyMatch =
    localBranches.length > 0 ||
    remoteGroups.size > 0 ||
    filteredTags.length > 0 ||
    filteredStashes.length > 0;

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="border-b bg-background/95 p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter refs"
              className="h-7 pl-7 pr-7 text-xs"
            />
            {filter && (
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setFilter("")}
                aria-label="Clear filter"
                className="absolute right-1 top-1/2 h-5 w-5 -translate-y-1/2"
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 px-1 py-2">
            <PrPanel repoPath={repoPath} />
            {needle && !hasAnyMatch && (
              <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                No refs match “{filter}”.
              </div>
            )}
            <Section
              title="Branches"
              icon={<GitBranch className="h-3.5 w-3.5" />}
              action={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCreateState({ open: true, startPoint: null });
                  }}
                  aria-label="New branch"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              }
            >
              {localBranches.length === 0 ? (
                <div className="py-1 pl-8 pr-2.5 text-xs text-muted-foreground">
                  {needle ? "No matches" : "No local branches"}
                </div>
              ) : (
                <div className="flex flex-col">
                  {localBranches.map((b) => (
                    <ContextMenu key={b.fullName}>
                      <ContextMenuTrigger asChild>
                        <RefItem
                          icon={b.isHead ? <Check className="h-3 w-3 text-primary" /> : null}
                          label={b.name}
                          emphasized={b.isHead}
                          onClick={() => {
                            if (b.target) selectCommit(b.target, null);
                          }}
                          onDoubleClick={() => {
                            if (!b.isHead) checkout.mutate({ target: b.name });
                          }}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem
                          disabled={b.isHead}
                          onSelect={() => checkout.mutate({ target: b.name })}
                        >
                          Checkout
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => setCreateState({ open: true, startPoint: b.name })}
                        >
                          New branch from here
                        </ContextMenuItem>
                        <ContextMenuSub>
                          <ContextMenuSubTrigger disabled={b.isHead}>
                            Merge into current
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent>
                            <ContextMenuItem onSelect={() => merge.mutate({ target: b.name })}>
                              Merge (fast-forward when possible)
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => merge.mutate({ target: b.name, noFf: true })}
                            >
                              Merge --no-ff (always create merge commit)
                            </ContextMenuItem>
                            <ContextMenuItem
                              onSelect={() => merge.mutate({ target: b.name, squash: true })}
                            >
                              Squash merge (stage changes; commit manually)
                            </ContextMenuItem>
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                        <ContextMenuItem
                          disabled={b.isHead}
                          onSelect={() => startRebase.mutate({ onto: b.name })}
                        >
                          Rebase current onto this
                        </ContextMenuItem>
                        <ContextMenuItem
                          disabled={b.isHead}
                          onSelect={() => setPlannerState({ open: true, onto: b.name })}
                        >
                          Rebase interactive onto this…
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() => setTagDialog({ open: true, target: b.name })}
                        >
                          New tag here…
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          onSelect={() => setRenameState({ open: true, name: b.name })}
                        >
                          Rename…
                        </ContextMenuItem>
                        <ContextMenuItem
                          variant="destructive"
                          disabled={b.isHead}
                          onSelect={() =>
                            setDeleteState({ open: true, name: b.name, target: b.target })
                          }
                        >
                          Delete
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Remotes"
              icon={<Cloud className="h-3.5 w-3.5" />}
              action={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRemotesOpen(true);
                  }}
                  aria-label="Manage remotes"
                >
                  <Settings2 className="h-3 w-3" />
                </Button>
              }
            >
              {remoteGroups.size === 0 ? (
                <div className="py-1 pl-8 pr-2.5 text-xs text-muted-foreground">
                  {needle ? "No matches" : "No remotes"}
                </div>
              ) : (
                [...remoteGroups.entries()].map(([remote, branches]) => (
                  <div key={remote} className="flex flex-col">
                    <div className="px-2.5 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
                      {remote}
                    </div>
                    <div className="flex flex-col">
                      {branches.map((b) => {
                        const upstream = `${b.remote}/${b.name}`;
                        const hasLocal = localBranchNames.has(b.name);
                        return (
                          <ContextMenu key={b.fullName}>
                            <ContextMenuTrigger asChild>
                              <RefItem
                                label={b.name}
                                onClick={() => {
                                  if (b.target) selectCommit(b.target, null);
                                }}
                              />
                            </ContextMenuTrigger>
                            <ContextMenuContent>
                              <ContextMenuItem
                                disabled={hasLocal}
                                onSelect={() =>
                                  checkoutTracking.mutate({
                                    localName: b.name,
                                    upstream,
                                  })
                                }
                              >
                                Checkout as new local
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() =>
                                  setCreateState({ open: true, startPoint: upstream })
                                }
                              >
                                New branch from here…
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() => startRebase.mutate({ onto: upstream })}
                              >
                                Rebase current onto this
                              </ContextMenuItem>
                              <ContextMenuItem
                                onSelect={() => setPlannerState({ open: true, onto: upstream })}
                              >
                                Rebase interactive onto this…
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </Section>

            <Section
              title="Tags"
              icon={<Tag className="h-3.5 w-3.5" />}
              defaultOpen={false}
              action={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTagDialog({ open: true, target: null });
                  }}
                  aria-label="New tag"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              }
            >
              {filteredTags.length === 0 ? (
                <div className="py-1 pl-8 pr-2.5 text-xs text-muted-foreground">
                  {needle ? "No matches" : "No tags"}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredTags.map((t) => (
                    <ContextMenu key={t.fullName}>
                      <ContextMenuTrigger asChild>
                        <RefItem
                          label={t.name}
                          onClick={() => {
                            if (t.target) selectCommit(t.target, null);
                          }}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <TagRemoteMenu
                          tagName={t.name}
                          remotes={remotes.data ?? []}
                          onPush={(remote) => pushTag.mutate({ remote, name: t.name })}
                          onDelete={(remote) =>
                            pushTag.mutate({ remote, name: t.name, deleteRemote: true })
                          }
                        />
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => deleteTag.mutate({ name: t.name, target: t.target })}
                        >
                          Delete locally
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </Section>

            <Section
              title="Stashes"
              icon={<Archive className="h-3.5 w-3.5" />}
              defaultOpen={false}
              action={
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={(e) => {
                    e.stopPropagation();
                    setStashOpen(true);
                  }}
                  aria-label="New stash"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              }
            >
              {filteredStashes.length === 0 ? (
                <div className="py-1 pl-8 pr-2.5 text-xs text-muted-foreground">
                  {needle ? "No matches" : "No stashes"}
                </div>
              ) : (
                <div className="flex flex-col">
                  {filteredStashes.map((s) => (
                    <ContextMenu key={s.refName}>
                      <ContextMenuTrigger asChild>
                        <RefItem
                          label={s.message}
                          onDoubleClick={() => applyStash.mutate(s.refName)}
                        />
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => applyStash.mutate(s.refName)}>
                          Apply
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => popStash.mutate(s.refName)}>
                          Pop (apply and drop)
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => dropStash.mutate(s.refName)}
                        >
                          Drop
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Reflog" icon={<History className="h-3.5 w-3.5" />} defaultOpen={false}>
              <RefItem
                label="HEAD"
                onClick={() => setView("reflog")}
                aria-current={currentView === "reflog" ? "page" : undefined}
                className={cn(
                  currentView === "reflog" &&
                    "bg-accent/40 font-medium text-foreground hover:bg-accent/40",
                )}
              />
            </Section>
          </div>
        </ScrollArea>
      </div>

      <CreateBranchDialog
        repoPath={repoPath}
        open={createState.open}
        onOpenChange={(o) => setCreateState((s) => ({ ...s, open: o }))}
        startPoint={createState.startPoint}
      />
      <RenameBranchDialog
        repoPath={repoPath}
        open={renameState.open}
        onOpenChange={(o) => setRenameState((s) => ({ ...s, open: o }))}
        oldName={renameState.name}
      />
      <DeleteBranchDialog
        repoPath={repoPath}
        open={deleteState.open}
        onOpenChange={(o) => setDeleteState((s) => ({ ...s, open: o }))}
        branchName={deleteState.name}
        branchTarget={deleteState.target}
      />
      <StashCreateDialog repoPath={repoPath} open={stashOpen} onOpenChange={setStashOpen} />
      <TagCreateDialog
        repoPath={repoPath}
        open={tagDialog.open}
        target={tagDialog.target}
        onOpenChange={(o) => setTagDialog((s) => ({ ...s, open: o }))}
      />
      <RemotesDialog repoPath={repoPath} open={remotesOpen} onOpenChange={setRemotesOpen} />
      <RebasePlannerDialog
        repoPath={repoPath}
        open={plannerState.open}
        onOpenChange={(o) => setPlannerState((s) => ({ ...s, open: o }))}
        from="HEAD"
        onto={plannerState.onto}
      />
    </>
  );
}

function Section({
  title,
  icon,
  action,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col">
      <div className="flex items-center justify-between pr-1">
        <CollapsibleTrigger className="group flex flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/60">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          {icon}
          {title}
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="flex flex-col pl-2 pr-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

type RefItemProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  icon?: React.ReactNode;
  label: string;
  emphasized?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
};

function RefItem({ icon, label, emphasized, ref, className, ...rest }: RefItemProps) {
  return (
    <button
      ref={ref}
      type="button"
      className={cn(
        "group flex h-7 select-none items-center gap-2 rounded-sm px-2.5 text-left text-sm",
        "hover:bg-accent hover:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        emphasized && "font-medium text-foreground",
        !emphasized && "text-foreground/85",
        className,
      )}
      {...rest}
    >
      <span className="flex w-3.5 shrink-0 items-center justify-center text-muted-foreground">
        {icon}
      </span>
      <span className="truncate" title={label}>
        {label}
      </span>
    </button>
  );
}

// Per-tag remote actions. Picks a sensible default when only one remote
// exists (no menu, just a direct item); falls back to a sub-menu when the
// repo has multiple remotes so the user can pick which one to push to.
function TagRemoteMenu({
  tagName,
  remotes,
  onPush,
  onDelete,
}: {
  tagName: string;
  remotes: { name: string }[];
  onPush: (remote: string) => void;
  onDelete: (remote: string) => void;
}) {
  if (remotes.length === 0) return null;

  const sorted = [...remotes].sort((a, b) => {
    if (a.name === "origin") return -1;
    if (b.name === "origin") return 1;
    return a.name.localeCompare(b.name);
  });

  if (sorted.length === 1) {
    const remote = sorted[0].name;
    return (
      <>
        <ContextMenuItem onSelect={() => onPush(remote)}>Push to {remote}</ContextMenuItem>
        <ContextMenuItem onSelect={() => onDelete(remote)}>Delete on {remote}</ContextMenuItem>
      </>
    );
  }

  // Suppress unused-name warning by referencing it in the aria label below.
  const _name = tagName;
  return (
    <>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Push tag to…</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {sorted.map((r) => (
            <ContextMenuItem
              key={r.name}
              onSelect={() => onPush(r.name)}
              aria-label={`Push ${_name} to ${r.name}`}
            >
              {r.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Delete tag on…</ContextMenuSubTrigger>
        <ContextMenuSubContent>
          {sorted.map((r) => (
            <ContextMenuItem key={r.name} variant="destructive" onSelect={() => onDelete(r.name)}>
              {r.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </>
  );
}
