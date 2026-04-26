import { useEffect, useMemo, useState } from "react";
import { FileIcon } from "@/components/file-icon";
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
import { useStatus } from "../hooks/use-status";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function StashCreateDialog({ repoPath, open, onOpenChange }: Props) {
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(false);
  const [keepIndex, setKeepIndex] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(() => new Set());
  const create = useCreateStash(repoPath);
  const { data: status } = useStatus(open ? repoPath : null);

  const stashable = useMemo(() => {
    if (!status) return [] as { path: string; code: string }[];
    const seen = new Set<string>();
    const out: { path: string; code: string }[] = [];
    for (const e of [...status.staged, ...status.unstaged]) {
      if (seen.has(e.path)) continue;
      seen.add(e.path);
      out.push({ path: e.path, code: e.code });
    }
    if (includeUntracked) {
      for (const u of status.untracked) {
        if (seen.has(u.path)) continue;
        seen.add(u.path);
        out.push({ path: u.path, code: "??" });
      }
    }
    return out.sort((a, b) => a.path.localeCompare(b.path));
  }, [status, includeUntracked]);

  useEffect(() => {
    if (open) {
      setMessage("");
      setIncludeUntracked(false);
      setKeepIndex(false);
      setSelectedPaths(new Set());
    }
  }, [open]);

  // Drop selected paths that disappear when `includeUntracked` is toggled off.
  useEffect(() => {
    setSelectedPaths((prev) => {
      const valid = new Set(stashable.map((f) => f.path));
      let changed = false;
      const next = new Set<string>();
      for (const p of prev) {
        if (valid.has(p)) next.add(p);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [stashable]);

  const allSelected = selectedPaths.size > 0 && selectedPaths.size === stashable.length;
  const togglePath = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };
  const toggleAll = () => {
    if (allSelected) setSelectedPaths(new Set());
    else setSelectedPaths(new Set(stashable.map((f) => f.path)));
  };

  const submit = async () => {
    try {
      await create.mutateAsync({
        message: message.trim() ? message.trim() : null,
        includeUntracked,
        keepIndex,
        // Empty selection = stash everything (preserves the v1 behavior).
        paths: selectedPaths.size > 0 ? Array.from(selectedPaths) : undefined,
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
          {stashable.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Files
                </Label>
                <button
                  type="button"
                  onClick={toggleAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="max-h-[200px] overflow-y-auto rounded-md border">
                {stashable.map((f) => {
                  const checked = selectedPaths.has(f.path);
                  return (
                    <label
                      key={f.path}
                      htmlFor={`stash-file-${f.path}`}
                      className="flex cursor-pointer items-center gap-2 px-2 py-1 text-[13px] hover:bg-muted/60"
                    >
                      <Checkbox
                        id={`stash-file-${f.path}`}
                        checked={checked}
                        onCheckedChange={() => togglePath(f.path)}
                      />
                      <FileIcon path={f.path} />
                      <span className="min-w-0 flex-1 truncate font-mono">{f.path}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedPaths.size === 0
                  ? "All files will be stashed."
                  : `${selectedPaths.size} of ${stashable.length} selected.`}
              </p>
            </div>
          )}
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
