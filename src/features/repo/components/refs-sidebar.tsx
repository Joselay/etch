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
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckout, useCheckoutTracking, useMerge } from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { useApplyStash, useDropStash, usePopStash, useStashes } from "../hooks/use-stash";
import { useDeleteTag, usePushTag } from "../hooks/use-tag-mutations";
import { CreateBranchDialog } from "./create-branch-dialog";
import { DeleteBranchDialog } from "./delete-branch-dialog";
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

  const [createState, setCreateState] = useState<CreateState>({ open: false, startPoint: null });
  const [renameState, setRenameState] = useState<BranchDialogState>({ open: false, name: "" });
  const [deleteState, setDeleteState] = useState<BranchDialogState>({ open: false, name: "" });
  const [stashOpen, setStashOpen] = useState(false);
  const [remotesOpen, setRemotesOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const stashes = useStashes(repoPath);
  const applyStash = useApplyStash(repoPath);
  const popStash = usePopStash(repoPath);
  const dropStash = useDropStash(repoPath);
  const merge = useMerge(repoPath);
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
          <div className="flex flex-col gap-1 p-2">
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
                <ItemGroup>
                  {localBranches.map((b) => (
                    <ContextMenu key={b.fullName}>
                      <ContextMenuTrigger asChild>
                        <RefItem
                          icon={b.isHead ? <Check className="h-3 w-3 text-primary" /> : null}
                          label={b.name}
                          emphasized={b.isHead}
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
                </ItemGroup>
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
                  <div key={remote} className="flex flex-col gap-0.5">
                    <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">
                      {remote}
                    </div>
                    <ItemGroup>
                      {branches.map((b) => {
                        const upstream = `${b.remote}/${b.name}`;
                        const hasLocal = localBranchNames.has(b.name);
                        return (
                          <ContextMenu key={b.fullName}>
                            <ContextMenuTrigger asChild>
                              <RefItem label={b.name} />
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
                            </ContextMenuContent>
                          </ContextMenu>
                        );
                      })}
                    </ItemGroup>
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
                <ItemGroup>
                  {filteredTags.map((t) => (
                    <ContextMenu key={t.fullName}>
                      <ContextMenuTrigger asChild>
                        <RefItem label={t.name} />
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
                </ItemGroup>
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
                <ItemGroup>
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
                </ItemGroup>
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
    <Collapsible defaultOpen className="flex flex-col gap-1">
      <div className="flex items-center justify-between pr-1">
        <CollapsibleTrigger className="group flex flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/60">
          <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
          {icon}
          {title}
        </CollapsibleTrigger>
        {action}
      </div>
      <CollapsibleContent className="flex flex-col gap-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function RefItem({
  icon,
  label,
  emphasized,
  onDoubleClick,
}: {
  icon?: React.ReactNode;
  label: string;
  emphasized?: boolean;
  onDoubleClick?: () => void;
}) {
  return (
    <Item
      size="sm"
      variant="muted"
      className="cursor-default rounded-sm border-0 bg-transparent px-2 py-1"
      onDoubleClick={onDoubleClick}
    >
      <ItemMedia className="w-3">{icon}</ItemMedia>
      <ItemContent>
        <ItemTitle className={emphasized ? "text-sm font-medium" : "text-sm font-normal"}>
          {label}
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}
