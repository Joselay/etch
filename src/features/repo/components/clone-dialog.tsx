import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { FolderOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useCloneRepo } from "../hooks/use-clone-repo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Best-effort parse of the repo name from a URL like
 * `git@github.com:owner/repo.git` or `https://github.com/owner/repo`.
 */
function repoNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const last =
    trimmed
      .split(/[\\/:]/)
      .filter(Boolean)
      .pop() ?? "";
  return last.replace(/\.git$/i, "");
}

function joinPath(parent: string, child: string): string {
  if (!parent) return child;
  const sep = parent.includes("\\") && !parent.includes("/") ? "\\" : "/";
  return parent.endsWith(sep) ? `${parent}${child}` : `${parent}${sep}${child}`;
}

export function CloneDialog({ open, onOpenChange }: Props) {
  const [url, setUrl] = useState("");
  const [parent, setParent] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const { cloneTo, isCloning } = useCloneRepo();

  useEffect(() => {
    if (open) {
      setUrl("");
      setParent("");
      setName("");
      setNameEdited(false);
    }
  }, [open]);

  // Auto-fill name from URL until the user edits it manually.
  useEffect(() => {
    if (!nameEdited) setName(repoNameFromUrl(url));
  }, [url, nameEdited]);

  const dest = useMemo(() => (parent && name ? joinPath(parent, name) : ""), [parent, name]);

  const pickParent = async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") setParent(selected);
  };

  const submit = async () => {
    if (!url.trim() || !dest) return;
    try {
      await cloneTo(url.trim(), dest);
      onOpenChange(false);
    } catch {
      // toast already shown
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Block closing while a clone is in flight.
        if (isCloning && !o) return;
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clone repository</DialogTitle>
          <DialogDescription>Clone a remote repository to your local machine.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <fieldset
            disabled={isCloning}
            className="flex flex-col gap-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clone-url">Repository URL</Label>
              <Input
                id="clone-url"
                autoFocus
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/owner/repo.git"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clone-parent">Parent directory</Label>
              <div className="flex gap-2">
                <Input
                  id="clone-parent"
                  value={parent}
                  onChange={(e) => setParent(e.target.value)}
                  placeholder="Choose a folder"
                />
                <Button type="button" variant="outline" onClick={pickParent}>
                  <FolderOpen />
                  Browse
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clone-name">Folder name</Label>
              <Input
                id="clone-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameEdited(true);
                }}
                placeholder="repo"
              />
            </div>
            {dest && (
              <p className="text-xs text-muted-foreground">
                Will clone into <code>{dest}</code>
              </p>
            )}
          </fieldset>
          {isCloning && (
            <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm">
                <Spinner className="h-4 w-4" />
                <span>
                  Cloning <span className="font-medium">{name || url}</span>…
                </span>
              </div>
              <Progress value={undefined} className="h-1.5" />
              <p className="text-[11px] text-muted-foreground">
                This can take a while for large repositories. The window will switch to the cloned
                repo when it's done.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isCloning}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!url.trim() || !dest || isCloning}>
              {isCloning ? <Spinner /> : null}
              {isCloning ? "Cloning…" : "Clone"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
