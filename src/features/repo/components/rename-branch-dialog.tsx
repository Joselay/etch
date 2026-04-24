import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRenameBranch } from "../hooks/use-branch-mutations";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldName: string;
};

export function RenameBranchDialog({ repoPath, open, onOpenChange, oldName }: Props) {
  const [name, setName] = useState(oldName);
  const rename = useRenameBranch(repoPath);

  useEffect(() => {
    if (open) setName(oldName);
  }, [open, oldName]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === oldName) {
      onOpenChange(false);
      return;
    }
    try {
      await rename.mutateAsync({ oldName, newName: trimmed });
      onOpenChange(false);
    } catch {
      // toast already shown
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename branch</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rename-branch-name">New name</Label>
          <Input
            id="rename-branch-name"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || rename.isPending}>
            Rename
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
