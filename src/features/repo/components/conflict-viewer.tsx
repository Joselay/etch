import { EditorView } from "@codemirror/view";
import CodeMirror from "@uiw/react-codemirror";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { hasConflictMarkers } from "@/lib/conflict-markers";
import type { ConflictEntry } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useConflictActions, useConflictSides } from "../hooks/use-conflicts";

type Props = {
  repoPath: string;
  entry: ConflictEntry;
};

export function ConflictViewer({ repoPath, entry }: Props) {
  const { data: sides, isLoading, error } = useConflictSides(repoPath, entry.path);
  const actions = useConflictActions(repoPath);
  const [draft, setDraft] = useState<string | null>(null);

  // Reset the editor when the selection changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on file swap
  useEffect(() => {
    setDraft(null);
  }, [entry.path]);

  const initial = sides?.working ?? sides?.ours ?? "";
  const current = draft ?? initial;
  const dirty = draft !== null && draft !== initial;
  const stillMarked = hasConflictMarkers(current);

  const pending =
    actions.resolveWith.isPending ||
    actions.resolveWithContent.isPending ||
    actions.markResolved.isPending;

  const saveResolved = () => {
    actions.resolveWithContent.mutate(
      { file: entry.path, content: current },
      { onSuccess: () => setDraft(null) },
    );
  };

  if (isLoading) {
    return <div className="p-4 text-xs text-muted-foreground">Loading conflict…</div>;
  }
  if (error) {
    return <div className="p-4 text-xs text-destructive">{(error as Error).message}</div>;
  }
  if (!sides) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle className="text-sm">No conflict data</EmptyTitle>
          <EmptyDescription>Select another conflicted file.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-3 py-2">
        <div className="min-w-0 flex-1">
          <div className="truncate font-mono text-xs">{entry.path}</div>
          <div className="text-[11px] text-muted-foreground">
            {stillMarked ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" /> Conflict markers still present
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> No markers — ready to stage
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => actions.resolveWith.mutate({ file: entry.path, side: "ours" })}
          >
            Use ours
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => actions.resolveWith.mutate({ file: entry.path, side: "theirs" })}
          >
            Use theirs
          </Button>
          <Button size="sm" disabled={pending || !dirty} onClick={saveResolved}>
            Save resolved
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={pending || stillMarked}
            title={
              stillMarked ? "Remove all conflict markers before marking resolved" : "Stage as-is"
            }
            onClick={() => actions.markResolved.mutate([entry.path])}
          >
            Mark resolved
          </Button>
        </div>
      </div>

      <ResizablePanelGroup
        id="loom:conflict-viewer:v1"
        orientation="vertical"
        className="min-h-0 flex-1"
      >
        <ResizablePanel id="loom:conflict-sides" defaultSize="40%" minSize="15%">
          <div
            className={cn(
              "grid h-full min-h-0 gap-0 overflow-hidden",
              sides.base ? "grid-cols-3" : "grid-cols-2",
            )}
          >
            <SidePane label="Ours" tone="ours" content={sides.ours} />
            {sides.base && <SidePane label="Base" tone="base" content={sides.base} />}
            <SidePane label="Theirs" tone="theirs" content={sides.theirs} />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel id="loom:conflict-merged" defaultSize="60%" minSize="25%">
          <div className="flex h-full min-h-0 flex-col">
            <div className="border-b bg-muted/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Merged (editable)
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <CodeMirror
                value={current}
                onChange={(v) => setDraft(v)}
                height="100%"
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  foldGutter: false,
                }}
                extensions={[EditorView.lineWrapping]}
                theme="dark"
                className="h-full text-[13px]"
              />
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

function SidePane({
  label,
  tone,
  content,
}: {
  label: string;
  tone: "ours" | "base" | "theirs";
  content: string | null;
}) {
  const toneClass = {
    ours: "bg-sky-500/5 border-sky-500/20",
    base: "bg-muted/20 border-border",
    theirs: "bg-emerald-500/5 border-emerald-500/20",
  }[tone];

  return (
    <div className={cn("flex min-h-0 flex-col border-r last:border-r-0", toneClass)}>
      <div className="shrink-0 border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <pre className="m-0 flex-1 overflow-auto whitespace-pre px-3 py-2 font-mono text-[12px] leading-5">
        {content ?? <span className="italic text-muted-foreground">(missing)</span>}
      </pre>
    </div>
  );
}
