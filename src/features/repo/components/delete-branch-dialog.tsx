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
          <AlertDialogTitle>
            {unmerged ? "Branch is not fully merged" : `Delete ${branchName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {unmerged
              ? `${branchName} contains commits not reachable from any other ref. Force-delete to discard them permanently.`
              : `This removes the local branch ${branchName}. Commits unique to it may become unreachable.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              run(unmerged);
            }}
            className={
              unmerged
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {unmerged ? "Force delete" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
