import { FileMinus, FilePen, FilePlus, FileQuestion, Undo2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { StatusEntry } from "@/lib/tauri";
import { useSelectionStore } from "@/stores/selection-store";
import { useCommit, useStageActions, useStatus, useWorkingDiff } from "../hooks/use-status";
import { DiffViewer } from "./diff-viewer";

type Props = { repoPath: string };

export function ChangesView({ repoPath }: Props) {
  const { data: status, isLoading } = useStatus(repoPath);
  const { stage, unstage, discard } = useStageActions(repoPath);
  const commit = useCommit(repoPath);
  const workingSide = useSelectionStore((s) => s.workingSide);
  const workingFilePath = useSelectionStore((s) => s.workingFilePath);
  const selectWorkingFile = useSelectionStore((s) => s.selectWorkingFile);

  const [message, setMessage] = useState("");
  const [amend, setAmend] = useState(false);
  const [discardTarget, setDiscardTarget] = useState<string | null>(null);

  const staged = status?.staged ?? [];
  const unstaged = status?.unstaged ?? [];
  const untracked = status?.untracked ?? [];

  const untrackedEntries = useMemo<StatusEntry[]>(
    () => untracked.map((u) => ({ path: u.path, oldPath: null, code: "??" })),
    [untracked],
  );

  useEffect(() => {
    if (!status || workingFilePath) return;
    if (staged.length > 0) selectWorkingFile("staged", staged[0].path);
    else if (unstaged.length > 0) selectWorkingFile("unstaged", unstaged[0].path);
    else if (untrackedEntries.length > 0) selectWorkingFile("unstaged", untrackedEntries[0].path);
  }, [status, workingFilePath, staged, unstaged, untrackedEntries, selectWorkingFile]);

  const nothingToShow =
    !isLoading && staged.length === 0 && unstaged.length === 0 && untracked.length === 0;

  return (
    <div className="flex h-full">
      <aside className="flex w-72 shrink-0 flex-col border-r">
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex flex-col gap-1 p-2">
              {["a", "b", "c", "d"].map((k) => (
                <Skeleton key={k} className="h-6 w-full" />
              ))}
            </div>
          ) : nothingToShow ? (
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyTitle className="text-sm">Working tree clean</EmptyTitle>
                <EmptyDescription>Nothing to commit.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="flex flex-col">
              <Group
                title="Staged"
                count={staged.length}
                action={
                  staged.length > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => unstage.mutate(staged.map((s) => s.path))}
                    >
                      Unstage all
                    </Button>
                  ) : null
                }
              >
                {staged.map((f) => (
                  <FileRow
                    key={`s-${f.path}`}
                    entry={f}
                    selected={workingSide === "staged" && workingFilePath === f.path}
                    onSelect={() => selectWorkingFile("staged", f.path)}
                    actionLabel="Unstage"
                    onAction={() => unstage.mutate([f.path])}
                  />
                ))}
              </Group>

              <Group
                title="Changed"
                count={unstaged.length}
                action={
                  unstaged.length > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => stage.mutate(unstaged.map((u) => u.path))}
                    >
                      Stage all
                    </Button>
                  ) : null
                }
              >
                {unstaged.map((f) => (
                  <FileRow
                    key={`u-${f.path}`}
                    entry={f}
                    selected={workingSide === "unstaged" && workingFilePath === f.path}
                    onSelect={() => selectWorkingFile("unstaged", f.path)}
                    actionLabel="Stage"
                    onAction={() => stage.mutate([f.path])}
                    secondary={
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 px-1.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDiscardTarget(f.path);
                        }}
                        title="Discard changes"
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    }
                  />
                ))}
              </Group>

              <Group
                title="Untracked"
                count={untracked.length}
                action={
                  untracked.length > 0 ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => stage.mutate(untracked.map((u) => u.path))}
                    >
                      Stage all
                    </Button>
                  ) : null
                }
              >
                {untrackedEntries.map((f) => (
                  <FileRow
                    key={`n-${f.path}`}
                    entry={f}
                    selected={workingSide === "unstaged" && workingFilePath === f.path}
                    onSelect={() => selectWorkingFile("unstaged", f.path)}
                    actionLabel="Stage"
                    onAction={() => stage.mutate([f.path])}
                  />
                ))}
              </Group>
            </div>
          )}
        </ScrollArea>

        <div className="flex flex-col gap-3 border-t p-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={amend ? "Amend commit message…" : "Commit message"}
            className="min-h-[80px] resize-none text-sm"
          />
          <Field orientation="horizontal">
            <Checkbox id="amend" checked={amend} onCheckedChange={(v) => setAmend(v === true)} />
            <FieldLabel htmlFor="amend" className="text-xs text-muted-foreground">
              Amend last commit
            </FieldLabel>
          </Field>
          {commit.error && (
            <div className="text-xs text-destructive">{(commit.error as Error).message}</div>
          )}
          <Button
            size="sm"
            disabled={
              commit.isPending || message.trim().length === 0 || (!amend && staged.length === 0)
            }
            onClick={() =>
              commit.mutate(
                { message: message.trim(), amend },
                {
                  onSuccess: () => {
                    setMessage("");
                    setAmend(false);
                  },
                },
              )
            }
          >
            {commit.isPending ? "Committing…" : amend ? "Amend" : "Commit"}
          </Button>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        {workingFilePath ? (
          <WorkingDiffPane
            repoPath={repoPath}
            filePath={workingFilePath}
            staged={workingSide === "staged"}
          />
        ) : (
          <Empty className="h-full">
            <EmptyHeader>
              <EmptyDescription>Select a file to see its changes.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </section>

      <AlertDialog open={!!discardTarget} onOpenChange={(o) => !o && setDiscardTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              Changes to <span className="font-mono text-foreground">{discardTarget}</span> will be
              lost and cannot be recovered.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (discardTarget) discard.mutate([discardTarget]);
                setDiscardTarget(null);
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Group({
  title,
  count,
  action,
  children,
}: {
  title: string;
  count: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center justify-between gap-2 bg-muted/40 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <span>
          {title} ({count})
        </span>
        {action}
      </div>
      <ItemGroup>{children}</ItemGroup>
    </div>
  );
}

function FileRow({
  entry,
  selected,
  onSelect,
  actionLabel,
  onAction,
  secondary,
}: {
  entry: StatusEntry;
  selected: boolean;
  onSelect: () => void;
  actionLabel: string;
  onAction: () => void;
  secondary?: React.ReactNode;
}) {
  return (
    <Item
      size="sm"
      variant="muted"
      data-selected={selected || undefined}
      className="group cursor-pointer rounded-none border-0 bg-transparent px-3 data-[selected]:bg-primary/10"
      onClick={onSelect}
    >
      <ItemMedia>
        <CodeIcon code={entry.code} />
      </ItemMedia>
      <ItemContent className="min-w-0">
        <ItemTitle className="truncate text-xs font-normal">{entry.path}</ItemTitle>
      </ItemContent>
      <ItemActions className="opacity-0 group-hover:opacity-100">
        {secondary}
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {actionLabel}
        </Button>
      </ItemActions>
    </Item>
  );
}

function CodeIcon({ code }: { code: string }) {
  const cls = "h-3.5 w-3.5 shrink-0";
  const c = code.trim();
  if (c === "??") return <FileQuestion className={`${cls} text-amber-500`} />;
  if (c.includes("A")) return <FilePlus className={`${cls} text-emerald-500`} />;
  if (c.includes("D")) return <FileMinus className={`${cls} text-rose-500`} />;
  return <FilePen className={`${cls} text-muted-foreground`} />;
}

function WorkingDiffPane({
  repoPath,
  filePath,
  staged,
}: {
  repoPath: string;
  filePath: string;
  staged: boolean;
}) {
  const { data, isLoading, error } = useWorkingDiff(repoPath, filePath, staged);
  if (isLoading) return <div className="p-4 text-xs text-muted-foreground">Loading diff…</div>;
  if (error) return <div className="p-4 text-xs text-destructive">{(error as Error).message}</div>;
  if (!data) return null;
  return <DiffViewer data={data} />;
}
