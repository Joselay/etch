import { AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { useDeleteBranch } from "../hooks/use-branch-mutations";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
};

export function DeleteBranchDialog({ repoPath, open, onOpenChange, branchName }: Props) {
  const del = useDeleteBranch(repoPath);
  const [unmerged, setUnmerged] = useState(false);

  useEffect(() => {
    if (open) setUnmerged(false);
  }, [open]);

  const run = async (force: boolean) => {
    try {
      await del.mutateAsync({ name: branchName, force });
      onOpenChange(false);
    } catch (err) {
      const msg = (err as Error).message || "";
      if (!force && /not fully merged/i.test(msg)) {
        setUnmerged(true);
        return;
      }
      toast.error(msg || "Failed to delete branch");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {unmerged && <AlertTriangle className="h-5 w-5 text-destructive" />}
            {unmerged ? `Force delete ${branchName}?` : `Delete ${branchName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {unmerged ? (
              <>
                <span className="font-mono text-foreground">{branchName}</span> contains commits not
                reachable from any other ref. Force-deleting will discard those commits{" "}
                <span className="font-semibold text-destructive">permanently</span>.
              </>
            ) : (
              <>
                This removes the local branch{" "}
                <span className="font-mono text-foreground">{branchName}</span>. Commits unique to
                it may become unreachable.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {unmerged && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This action cannot be undone. Make sure you've pushed any commits you want to keep.
            </span>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant={unmerged ? "destructive" : "default"}
            onClick={(e) => {
              e.preventDefault();
              run(unmerged);
            }}
          >
            {unmerged ? "Force delete" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
