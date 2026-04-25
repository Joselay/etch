import { AlertTriangle } from "lucide-react";
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
import type { CommitSummary, ResetMode } from "@/lib/tauri";
import { useReset } from "../hooks/use-branch-mutations";

type Props = {
  repoPath: string;
  commit: CommitSummary | null;
  mode: ResetMode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const COPY: Record<
  ResetMode,
  { title: string; description: string; cta: string; destructive: boolean }
> = {
  soft: {
    title: "Soft reset to this commit?",
    description: "Branch tip moves but staged changes and your working tree are preserved.",
    cta: "Soft reset",
    destructive: false,
  },
  mixed: {
    title: "Mixed reset to this commit?",
    description:
      "Branch tip moves and the index is cleared. Working-tree files are kept, but anything previously staged will need to be re-staged.",
    cta: "Mixed reset",
    destructive: true,
  },
  hard: {
    title: "Hard reset to this commit?",
    description:
      "Discards all changes in your working tree and index. Commits ahead of the target on the current branch will be lost (unless they're reachable from another ref).",
    cta: "Hard reset",
    destructive: true,
  },
};

export function ResetConfirmDialog({ repoPath, commit, mode, open, onOpenChange }: Props) {
  const reset = useReset(repoPath);
  const copy = COPY[mode];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {copy.destructive && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {copy.title}
          </AlertDialogTitle>
          <AlertDialogDescription>{copy.description}</AlertDialogDescription>
        </AlertDialogHeader>
        {commit && (
          <div className="rounded-md border bg-muted/50 p-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resetting to
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <code className="font-mono text-sm font-semibold text-foreground">
                {commit.shortId}
              </code>
              <span className="truncate text-xs text-muted-foreground">{commit.summary}</span>
            </div>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={copy.destructive ? "destructive" : "default"}
            disabled={!commit || reset.isPending}
            onClick={async (e) => {
              e.preventDefault();
              if (!commit) return;
              try {
                await reset.mutateAsync({ target: commit.id, mode });
                onOpenChange(false);
              } catch {
                // toast already shown
              }
            }}
          >
            {copy.cta}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
