import {
  Archive,
  Check,
  ChevronRight,
  GitBranch,
  Plus,
  Search,
  Settings2,
  Tag,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useSelectionStore } from "@/stores/selection-store";
import {
  useCheckout,
  useCheckoutTracking,
  useMerge,
  useStartRebase,
} from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { useApplyStash, useDropStash, usePopStash, useStashes } from "../hooks/use-stash";
import { useDeleteTag, usePushTag } from "../hooks/use-tag-mutations";
import { CreateBranchDialog } from "./create-branch-dialog";
import { DeleteBranchDialog } from "./delete-branch-dialog";
import { RebasePlannerDialog } from "./rebase-planner-dialog";
import { RemotesDialog } from "./remotes-dialog";
import { RenameBranchDialog } from "./rename-branch-dialog";
import { StashCreateDialog } from "./stash-create-dialog";
import { TagCreateDialog } from "./tag-create-dialog";

type Props = { repoPath: string };

type CreateState = { open: boolean; startPoint: string | null };
type BranchDialogState = { open: boolean; name: string };

export function RefsSidebar({ repoPath }: Props) {
  const { data, isLoading, error } = useRefs(repoPath);
  const checkout = useCheckout(repoPath);
  const checkoutTracking = useCheckoutTracking(repoPath);
  const selectCommit = useSelectionStore((s) => s.selectCommit);

  const [createState, setCreateState] = useState<CreateState>({ open: false, startPoint: null });
  const [renameState, setRenameState] = useState<BranchDialogState>({ open: false, name: "" });
  const [deleteState, setDeleteState] = useState<BranchDialogState>({ open: false, name: "" });
  const [plannerState, setPlannerState] = useState<{ open: boolean; onto: string }>({
    open: false,
    onto: "",
  });
  const [stashOpen, setStashOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [filter, setFilter] = useState("");

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
    return <div className="p-3 text-xs text-destructive">{(error as Error).message}</div>;
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
                <div className="px-2 py-1 text-xs text-muted-foreground">
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
                        <ContextMenuItem
                          disabled={b.isHead}
                          onSelect={() => merge.mutate({ target: b.name })}
                        >
                          Merge into current
                        </ContextMenuItem>
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
                          onSelect={() => setDeleteState({ open: true, name: b.name })}
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
              icon={<GitBranch className="h-3.5 w-3.5" />}
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
                <div className="px-2 py-1 text-muted-foreground text-xs">
                  {needle ? "No matches" : "No remotes"}
                </div>
              ) : (
                [...remoteGroups.entries()].map(([remote, branches]) => (
                  <div key={remote} className="flex flex-col">
                    <div className="px-3 pt-1.5 pb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
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
                <div className="px-2 py-1 text-xs text-muted-foreground">
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
                        <ContextMenuItem
                          onSelect={() => pushTag.mutate({ remote: "origin", name: t.name })}
                        >
                          Push to origin
                        </ContextMenuItem>
                        <ContextMenuItem
                          onSelect={() =>
                            pushTag.mutate({
                              remote: "origin",
                              name: t.name,
                              deleteRemote: true,
                            })
                          }
                        >
                          Delete on origin
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem
                          variant="destructive"
                          onSelect={() => deleteTag.mutate(t.name)}
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
                <div className="px-2 py-1 text-xs text-muted-foreground">
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
}: {
  title: string;
  icon: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Collapsible defaultOpen className="flex flex-col">
      <div className="flex items-center justify-between pr-1">
        <CollapsibleTrigger className="group flex flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/60">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          {icon}
          {title}
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="flex flex-col">{children}</CollapsibleContent>
    </Collapsible>
  );
}

type RefItemProps = React.HTMLAttributes<HTMLDivElement> & {
  icon?: React.ReactNode;
  label: string;
  emphasized?: boolean;
  ref?: React.Ref<HTMLDivElement>;
};

function RefItem({ icon, label, emphasized, ref, className, ...rest }: RefItemProps) {
  return (
    <div
      ref={ref}
      className={cn(
        "group flex h-7 cursor-default select-none items-center gap-2 rounded-sm px-2.5 text-sm",
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
    </div>
  );
}
