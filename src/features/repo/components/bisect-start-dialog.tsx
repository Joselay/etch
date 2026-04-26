import { useEffect, useState } from "react";
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
import { useBisectStart } from "../hooks/use-bisect";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  badDefault?: string;
};

export function BisectStartDialog({ repoPath, open, onOpenChange, badDefault }: Props) {
  const start = useBisectStart(repoPath);
  const [bad, setBad] = useState("");
  const [good, setGood] = useState("");

  useEffect(() => {
    if (open) {
      setBad(badDefault ?? "HEAD");
      setGood("");
    }
  }, [open, badDefault]);

  const submit = () => {
    if (!bad.trim() || !good.trim()) return;
    start.mutate({ bad: bad.trim(), good: good.trim() }, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !start.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start bisect</DialogTitle>
          <DialogDescription>
            Mark a known-bad commit (where the bug exists) and a known-good commit (an earlier
            ancestor where the bug does not exist). Git will check out the midpoint for you to test.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bisect-bad">Bad commit (bug present)</Label>
            <Input
              id="bisect-bad"
              value={bad}
              onChange={(e) => setBad(e.target.value)}
              placeholder="HEAD"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bisect-good">Good commit (bug absent)</Label>
            <Input
              id="bisect-good"
              value={good}
              onChange={(e) => setGood(e.target.value)}
              placeholder="v1.2.0"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={start.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!bad.trim() || !good.trim() || start.isPending}>
              {start.isPending ? "Starting…" : "Start bisect"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
