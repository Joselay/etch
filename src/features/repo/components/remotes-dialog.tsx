import { Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ProviderIcon } from "@/components/provider-icon";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { RemoteInfo } from "@/lib/tauri";
import {
  useAddRemote,
  useRemotes,
  useRemoveRemote,
  useRenameRemote,
  useSetRemoteUrl,
} from "../hooks/use-remotes";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function RemotesDialog({ repoPath, open, onOpenChange }: Props) {
  const { data, isLoading } = useRemotes(open ? repoPath : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Remotes</DialogTitle>
          <DialogDescription>Manage where Etch fetches from and pushes to.</DialogDescription>
        </DialogHeader>

        <section className="flex flex-col gap-3">
          {isLoading || !data ? (
            <Skeleton className="h-24 w-full" />
          ) : data.length === 0 ? (
            <p className="text-muted-foreground text-sm">No remotes configured.</p>
          ) : (
            data.map((r, i) => (
              <div key={r.name} className="flex flex-col gap-3">
                {i > 0 && <Separator />}
                <RemoteRow repoPath={repoPath} remote={r} />
              </div>
            ))
          )}
        </section>

        <Separator />

        <AddRemoteSection repoPath={repoPath} />
      </DialogContent>
    </Dialog>
  );
}

function RemoteRow({ repoPath, remote }: { repoPath: string; remote: RemoteInfo }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(remote.name);
  const [url, setUrl] = useState(remote.url);
  const rename = useRenameRemote(repoPath);
  const setUrlM = useSetRemoteUrl(repoPath);
  const remove = useRemoveRemote(repoPath);

  useEffect(() => {
    setName(remote.name);
    setUrl(remote.url);
  }, [remote]);

  const pending = rename.isPending || setUrlM.isPending || remove.isPending;

  const save = async () => {
    try {
      if (name !== remote.name) {
        await rename.mutateAsync({ oldName: remote.name, newName: name });
      }
      if (url !== remote.url) {
        await setUrlM.mutateAsync({ name, url });
      }
      setEditing(false);
    } catch {
      // toast already shown
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <ProviderIcon url={remote.url} className="mt-0.5 h-4 w-4" />
          <div className="min-w-0">
            <div className="font-medium text-sm">{remote.name}</div>
            <div className="truncate text-muted-foreground text-xs">{remote.url}</div>
            {remote.pushUrl && (
              <div className="truncate text-muted-foreground text-xs">push: {remote.pushUrl}</div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label="Edit remote"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => remove.mutate(remote.name)}
            disabled={pending}
            aria-label="Remove remote"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`remote-name-${remote.name}`}>Name</Label>
        <Input
          id={`remote-name-${remote.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`remote-url-${remote.name}`}>URL</Label>
        <Input
          id={`remote-url-${remote.name}`}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditing(false);
            setName(remote.name);
            setUrl(remote.url);
          }}
        >
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={pending || !name.trim() || !url.trim()}>
          Save
        </Button>
      </div>
    </div>
  );
}

function AddRemoteSection({ repoPath }: { repoPath: string }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const add = useAddRemote(repoPath);

  const submit = async () => {
    if (!name.trim() || !url.trim()) return;
    try {
      await add.mutateAsync({ name: name.trim(), url: url.trim() });
      setName("");
      setUrl("");
    } catch {
      // toast already shown
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-3"
    >
      <h4 className="flex items-center gap-1.5 font-semibold text-sm">
        <Plus className="h-3.5 w-3.5" />
        Add remote
      </h4>
      <div className="grid grid-cols-[8rem_1fr_auto] items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-remote-name">Name</Label>
          <Input
            id="new-remote-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="origin"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="new-remote-url">URL</Label>
          <Input
            id="new-remote-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="git@github.com:owner/repo.git"
          />
        </div>
        <Button type="submit" disabled={!name.trim() || !url.trim() || add.isPending}>
          Add
        </Button>
      </div>
    </form>
  );
}
