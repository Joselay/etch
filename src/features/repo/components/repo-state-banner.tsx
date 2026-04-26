import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, XCircle } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { RepoState } from "@/lib/tauri";
import { useBisectLog, useBisectMark } from "../hooks/use-bisect";
import {
  type SequencerOp,
  useAbortBisect,
  useAbortOp,
  useContinueOp,
  useRepoState,
  useSkipRebase,
} from "../hooks/use-repo-state";

function activeOp(state: RepoState): SequencerOp | null {
  if (state.merging) return "merge";
  if (state.reverting) return "revert";
  if (state.cherryPicking) return "cherryPick";
  if (state.rebasing) return "rebase";
  return null;
}

function opTitle(op: SequencerOp, state: RepoState): string {
  if (op === "merge") return "Merge in progress";
  if (op === "revert") return "Revert in progress";
  if (op === "cherryPick") return "Cherry-pick in progress";
  const r = state.rebase;
  const branch = r?.headName?.replace(/^refs\/heads\//, "");
  const step =
    r?.currentStep != null && r.totalSteps != null ? ` (${r.currentStep}/${r.totalSteps})` : "";
  return branch ? `Rebasing ${branch}${step}` : `Rebase in progress${step}`;
}

export function RepoStateBanner({ repoPath }: { repoPath: string }) {
  const { data } = useRepoState(repoPath);
  const abort = useAbortOp(repoPath);
  const cont = useContinueOp(repoPath);
  const skip = useSkipRebase(repoPath);

  if (!data) return null;
  const op = activeOp(data);

  if (!op) {
    if (data.bisecting) {
      return <BisectBanner repoPath={repoPath} />;
    }
    return null;
  }

  const pending = abort.isPending || cont.isPending || skip.isPending;
  const tone = data.hasConflicts ? "danger" : "warning";
  const description = data.hasConflicts
    ? "Resolve the conflicted files, stage them, then continue."
    : op === "rebase"
      ? "No conflicts — continue to apply the next step, or skip it."
      : "Conflicts resolved. You can continue or abort.";

  return (
    <InfoBar
      tone={tone}
      icon={
        data.hasConflicts ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
      }
      title={opTitle(op, data)}
      description={description}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => abort.mutate(op)} disabled={pending}>
            Abort
          </Button>
          {op === "rebase" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => skip.mutate()}
              disabled={pending}
              title="Drop the current commit and move to the next step"
            >
              Skip
            </Button>
          )}
          <Button size="sm" onClick={() => cont.mutate(op)} disabled={pending || data.hasConflicts}>
            Continue
          </Button>
        </>
      }
    />
  );
}

function BisectBanner({ repoPath }: { repoPath: string }) {
  const mark = useBisectMark(repoPath);
  const abort = useAbortBisect(repoPath);
  const { data: log } = useBisectLog(repoPath);
  const [logOpen, setLogOpen] = useState(false);
  const pending = mark.isPending || abort.isPending;
  return (
    <div
      className="flex flex-col gap-2 border-b border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm"
      role="status"
    >
      <div className="flex flex-wrap items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="font-medium">Bisect in progress</div>
          <div className="text-muted-foreground text-xs">
            Test the currently checked-out commit, then mark it good or bad. Skip if untestable.
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => mark.mutate("good")} disabled={pending}>
            Good
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => mark.mutate("bad")}
            disabled={pending}
          >
            Bad
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => mark.mutate("skip")}
            disabled={pending}
          >
            Skip
          </Button>
          <Button size="sm" variant="ghost" onClick={() => abort.mutate()} disabled={pending}>
            Reset
          </Button>
        </div>
      </div>
      {log && log.length > 0 && (
        <div className="flex flex-col gap-1 text-xs">
          <button
            type="button"
            onClick={() => setLogOpen((v) => !v)}
            className="inline-flex w-fit items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            {logOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {log.length} marked
          </button>
          {logOpen && (
            <ul className="ml-4 flex flex-col gap-0.5 font-mono text-[11px]">
              {log.map((e) => (
                <li key={`${e.verdict}-${e.oid}`}>
                  <span className="text-muted-foreground">{e.verdict}</span>{" "}
                  <span>{e.oid.slice(0, 7)}</span> <span className="opacity-70">{e.subject}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function InfoBar({
  tone,
  icon,
  title,
  description,
  actions,
}: {
  tone: "warning" | "danger";
  icon: React.ReactNode;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  const bg =
    tone === "danger"
      ? "border-destructive/50 bg-destructive/10 text-destructive-foreground"
      : "border-amber-500/50 bg-amber-500/10 text-foreground";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 border-b px-3 py-2 text-sm ${bg}`}
      role="status"
    >
      <span className="shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-xs">{description}</div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
