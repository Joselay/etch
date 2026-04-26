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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRefs } from "../hooks/use-refs";
import { usePush } from "../hooks/use-remote-ops";
import { useRemotes } from "../hooks/use-remotes";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentBranch: string | null;
};

export function PushPickerDialog({ repoPath, open, onOpenChange, currentBranch }: Props) {
  const { data: remotes } = useRemotes(repoPath);
  const { data: refs } = useRefs(repoPath);
  const pushOp = usePush(repoPath);

  const [remote, setRemote] = useState<string>("");
  const [branch, setBranch] = useState<string>("");
  const [setUpstream, setSetUpstream] = useState(true);
  const [forceWithLease, setForceWithLease] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRemote(remotes?.[0]?.name ?? "");
    setBranch(currentBranch ?? "");
    setSetUpstream(true);
    setForceWithLease(false);
  }, [open, remotes, currentBranch]);

  const localBranches = refs?.local ?? [];

  const submit = () => {
    if (!remote || !branch) return;
    pushOp.mutate(
      { remote, branch, setUpstream, forceWithLease },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pushOp.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Push to…</DialogTitle>
          <DialogDescription>
            Choose the remote and branch to push to. Leave the branch as-is to push the current
            branch.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          <fieldset
            disabled={pushOp.isPending}
            className="flex flex-col gap-4 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="push-remote">Remote</Label>
              {remotes && remotes.length > 0 ? (
                <Select value={remote} onValueChange={setRemote}>
                  <SelectTrigger id="push-remote">
                    <SelectValue placeholder="Select remote" />
                  </SelectTrigger>
                  <SelectContent>
                    {remotes.map((r) => (
                      <SelectItem key={r.name} value={r.name}>
                        <span className="font-medium">{r.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{r.url}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No remotes configured. Add one from the repository menu.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="push-branch">Branch</Label>
              {localBranches.length > 0 ? (
                <Select value={branch} onValueChange={setBranch}>
                  <SelectTrigger id="push-branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {localBranches.map((b) => (
                      <SelectItem key={b.fullName} value={b.name}>
                        {b.name}
                        {b.isHead && (
                          <span className="ml-2 text-xs text-muted-foreground">(current)</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="push-branch"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="branch name"
                />
              )}
            </div>

            <Field orientation="horizontal">
              <Checkbox
                id="push-set-upstream"
                checked={setUpstream}
                onCheckedChange={(v) => setSetUpstream(v === true)}
              />
              <FieldLabel htmlFor="push-set-upstream" className="text-xs">
                Set as upstream tracking branch
              </FieldLabel>
            </Field>

            <Field orientation="horizontal">
              <Checkbox
                id="push-force"
                checked={forceWithLease}
                onCheckedChange={(v) => setForceWithLease(v === true)}
              />
              <FieldLabel htmlFor="push-force" className="text-xs">
                Force push with lease (overwrite if local refs match)
              </FieldLabel>
            </Field>
          </fieldset>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pushOp.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!remote || !branch || pushOp.isPending}>
              {pushOp.isPending ? "Pushing…" : "Push"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
