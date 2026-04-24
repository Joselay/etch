import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RepoState } from "@/lib/tauri";
import { useAbortOp, useContinueOp, useRepoState } from "../hooks/use-repo-state";

type Op = "merge" | "revert" | "cherryPick";

function activeOp(state: RepoState): Op | null {
  if (state.merging) return "merge";
  if (state.reverting) return "revert";
  if (state.cherryPicking) return "cherryPick";
  return null;
}

const opLabels: Record<Op, string> = {
  merge: "Merge in progress",
  revert: "Revert in progress",
  cherryPick: "Cherry-pick in progress",
};

export function RepoStateBanner({ repoPath }: { repoPath: string }) {
  const { data } = useRepoState(repoPath);
  const abort = useAbortOp(repoPath);
  const cont = useContinueOp(repoPath);

  if (!data) return null;
  const op = activeOp(data);

  // Rebase / bisect: we don't support continue yet, so just surface the state.
  if (!op) {
    if (data.rebasing) {
      return (
        <InfoBar
          tone="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Rebase in progress"
          description="Finish or abort the rebase from the terminal — Loom doesn't manage interactive rebase yet."
        />
      );
    }
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

  const pending = abort.isPending || cont.isPending;
  const tone = data.hasConflicts ? "danger" : "warning";

  return (
    <InfoBar
      tone={tone}
      icon={
        data.hasConflicts ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
      }
      title={opLabels[op]}
      description={
        data.hasConflicts
          ? "Resolve the conflicted files, stage them, then continue."
          : "Conflicts resolved. You can continue or abort."
      }
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => abort.mutate(op)} disabled={pending}>
            Abort
          </Button>
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
