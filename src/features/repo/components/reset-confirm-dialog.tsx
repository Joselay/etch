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
import { buttonVariants } from "@/components/ui/button";
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
          <AlertDialogTitle>Hard reset to this commit?</AlertDialogTitle>
          <AlertDialogDescription>
            This will discard all changes in your working tree and index. Commits ahead of{" "}
            <code className="text-foreground">{commit?.shortId}</code> on the current branch will be
            lost (unless they're reachable from another ref).
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={reset.isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={!commit || reset.isPending}
            className={buttonVariants({ variant: "destructive" })}
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
