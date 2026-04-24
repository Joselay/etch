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
import type { CommitSummary } from "@/lib/tauri";
import { useReset } from "../hooks/use-branch-mutations";

type Props = {
  repoPath: string;
  commit: CommitSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ResetHardConfirmDialog({ repoPath, commit, open, onOpenChange }: Props) {
  const reset = useReset(repoPath);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Hard reset to this commit?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This discards all changes in your working tree and index. Commits ahead of the target on
            the current branch will be lost (unless they're reachable from another ref).
          </AlertDialogDescription>
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
            variant="destructive"
            disabled={!commit || reset.isPending}
            onClick={async (e) => {
              e.preventDefault();
              if (!commit) return;
              try {
                await reset.mutateAsync({ target: commit.id, mode: "hard" });
                onOpenChange(false);
              } catch {
                // toast already shown
              }
            }}
          >
            Hard reset
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
