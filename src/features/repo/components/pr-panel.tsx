import { openUrl } from "@tauri-apps/plugin-opener";
import { CheckCircle2, Circle, ExternalLink, GitPullRequest, XCircle } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import { Skeleton } from "@/components/ui/skeleton";
import type { PullRequest } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useCiStatus, usePullRequests } from "../hooks/use-github";
import { useRefs } from "../hooks/use-refs";

type Props = { repoPath: string };

export function PrPanel({ repoPath }: Props) {
  const { data: refs } = useRefs(repoPath);
  const branch = refs?.headRef?.replace(/^refs\/heads\//, "") ?? null;
  const headOid = refs?.headCommitId ?? null;
  const prs = usePullRequests(repoPath, branch);
  const ci = useCiStatus(repoPath, headOid);

  if (prs.error || ci.error) {
    // Quietly omit when not configured/authed; surface errors only via tooltip on hover.
    return null;
  }

  if (prs.isLoading) {
    return (
      <div className="flex flex-col gap-2 p-2">
        <Skeleton className="h-7 w-full" />
      </div>
    );
  }

  const list = prs.data ?? [];
  const ciStatus = ci.data;

  if (list.length === 0 && !ciStatus) return null;

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
        <ProviderIcon url="https://github.com" className="h-3 w-3" />
        <span className="font-medium">GitHub</span>
      </div>
      {list.length > 0 && (
        <div className="flex flex-col gap-1">
          {list.map((pr) => (
            <PrRow key={pr.number} pr={pr} />
          ))}
        </div>
      )}
      {ciStatus && ciStatus.runs.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border bg-background/40 px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CiIcon state={ciStatus.state} />
            <span className="font-medium text-foreground">
              {ciStatus.state === "success"
                ? "All checks passing"
                : ciStatus.state === "failure"
                  ? "Some checks failing"
                  : ciStatus.state === "pending"
                    ? "Checks running"
                    : "No checks"}
            </span>
            <span className="ml-auto">
              {ciStatus.runs.length} run{ciStatus.runs.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PrRow({ pr }: { pr: PullRequest }) {
  return (
    <button
      type="button"
      onClick={() => void openUrl(pr.url)}
      className="group flex w-full items-start gap-2 rounded-md border bg-background/40 px-2 py-1.5 text-left text-xs hover:bg-accent/40"
    >
      <GitPullRequest
        className={cn(
          "mt-0.5 h-3.5 w-3.5 shrink-0",
          pr.state === "open" ? "text-foreground" : "text-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">#{pr.number}</span>
          <span className="text-muted-foreground">{pr.draft ? "draft" : pr.state}</span>
        </div>
        <div className="truncate">{pr.title}</div>
      </div>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

function CiIcon({ state }: { state: string }) {
  if (state === "success") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (state === "failure") return <XCircle className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}
