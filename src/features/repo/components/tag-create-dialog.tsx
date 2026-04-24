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
import { useCreateTag } from "../hooks/use-tag-mutations";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Commit-ish (branch, SHA) to tag. Null = current HEAD. */
  target: string | null;
};

export function TagCreateDialog({ repoPath, open, onOpenChange, target }: Props) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [force, setForce] = useState(false);
  const create = useCreateTag(repoPath);

  useEffect(() => {
    if (open) {
      setName("");
      setMessage("");
      setForce(false);
    }
  }, [open]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await create.mutateAsync({
        name: trimmed,
        message: message.trim() ? message.trim() : null,
        target,
        force,
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
          <DialogTitle>Create tag</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                Tag <code className="text-xs">{target}</code>
              </>
            ) : (
              "Tag current HEAD"
            )}
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
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="v1.0.0"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-message">Message (optional, makes annotated tag)</Label>
            <Input
              id="tag-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Release 1.0"
            />
          </div>
          <label htmlFor="tag-force" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="tag-force"
              checked={force}
              onCheckedChange={(v) => setForce(v === true)}
            />
            Force (overwrite if tag exists)
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
