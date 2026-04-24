import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RepoState } from "@/lib/tauri";
import {
  type SequencerOp,
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
      return (
        <InfoBar
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Bisect in progress"
          description="Resolve the bisect from the terminal (`git bisect good/bad/reset`)."
        />
      );
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
