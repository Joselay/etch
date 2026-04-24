import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateStash } from "../hooks/use-stash";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StashCreateDialog({ repoPath, open, onOpenChange }: Props) {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const create = useCreateStash(repoPath);

  useEffect(() => {
    if (open) {
      setMessage("");
      setIncludeUntracked(false);
      setKeepIndex(false);
    }
  }, [open]);

  const submit = async () => {
    try {
      await create.mutateAsync({
        message: message.trim() ? message.trim() : null,
        includeUntracked,
        keepIndex,
      });
      onOpenChange(false);
    } catch {
      // toast already shown
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Stash changes</DialogTitle>
          <DialogDescription>
            Save your working-copy and staged changes so you can switch context.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stash-message">Message (optional)</Label>
            <Input
              id="stash-message"
              autoFocus
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="wip: refactor auth flow"
            />
          </div>
          <label htmlFor="stash-include-untracked" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="stash-include-untracked"
              checked={includeUntracked}
              onCheckedChange={(v) => setIncludeUntracked(v === true)}
            />
            Include untracked files
          </label>
          <label htmlFor="stash-keep-index" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="stash-keep-index"
              checked={keepIndex}
              onCheckedChange={(v) => setKeepIndex(v === true)}
            />
            Keep staged changes in index
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Stashing…" : "Stash"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
