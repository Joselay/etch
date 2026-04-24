import { Check, ChevronRight, GitBranch, Plus, Tag } from "lucide-react";
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
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useCheckout, useCheckoutTracking } from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { CreateBranchDialog } from "./create-branch-dialog";
import { DeleteBranchDialog } from "./delete-branch-dialog";
import { RenameBranchDialog } from "./rename-branch-dialog";

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

  const remoteGroups = useMemo(() => {
    const map = new Map<
      string,
      { name: string; fullName: string; target: string | null; remote: string }[]
    >();
    if (!data) return map;
    for (const r of data.remote) {
      const key = r.remote ?? "origin";
      const arr = map.get(key) ?? [];
      arr.push({ name: r.name, fullName: r.fullName, target: r.target, remote: key });
      map.set(key, arr);
    }
    return map;
  }, [data]);

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

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-2">
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
            {data.local.length === 0 ? (
              <div className="px-2 py-1 text-xs text-muted-foreground">No local branches</div>
            ) : (
              <ItemGroup>
                {data.local.map((b) => (
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

          {remoteGroups.size > 0 && (
            <Section title="Remotes" icon={<GitBranch className="h-3.5 w-3.5" />}>
              {[...remoteGroups.entries()].map(([remote, branches]) => (
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
                              onSelect={() => setCreateState({ open: true, startPoint: upstream })}
                            >
                              New branch from here…
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      );
                    })}
                  </ItemGroup>
                </div>
              ))}
            </Section>
          )}

          {data.tags.length > 0 && (
            <Section title="Tags" icon={<Tag className="h-3.5 w-3.5" />}>
              <ItemGroup>
                {data.tags.map((t) => (
                  <RefItem key={t.fullName} label={t.name} />
                ))}
              </ItemGroup>
            </Section>
          )}
        </div>
      </ScrollArea>

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
