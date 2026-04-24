import { ArrowDown, ArrowUp, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { onMenuEvent } from "@/lib/menu-events";
import { cn } from "@/lib/utils";
import { useFetch, usePull, usePush, useUpstreamStatus } from "../hooks/use-remote-ops";

type Props = { repoPath: string };

export function RemoteActions({ repoPath }: Props) {
  const { data: upstream } = useUpstreamStatus(repoPath);
  const fetchOp = useFetch(repoPath);
  const pullOp = usePull(repoPath);
  const pushOp = usePush(repoPath);

  const hasUpstream = !!upstream?.upstream;
  const ahead = upstream?.ahead ?? 0;
  const behind = upstream?.behind ?? 0;

  const anyPending = fetchOp.isPending || pullOp.isPending || pushOp.isPending;

  useEffect(() => {
    const offs = [
      onMenuEvent("fetch", () => {
        if (!fetchOp.isPending && !pullOp.isPending && !pushOp.isPending) {
          fetchOp.mutate({});
        }
      }),
      onMenuEvent("pull", () => {
        if (anyPendingRef()) return;
        if (upstream?.upstream && (upstream.behind ?? 0) > 0) pullOp.mutate({});
      }),
      onMenuEvent("push", () => {
        if (anyPendingRef()) return;
        const has = !!upstream?.upstream;
        if (!has || (upstream.ahead ?? 0) > 0) {
          pushOp.mutate(has ? {} : { setUpstream: true });
        }
      }),
    ];
    function anyPendingRef() {
      return fetchOp.isPending || pullOp.isPending || pushOp.isPending;
    }
    return () => {
      for (const off of offs) off();
    };
  }, [fetchOp, pullOp, pushOp, upstream]);

  const upstreamLabel = upstream?.upstream ?? "no upstream";
  const branchLabel = upstream?.branch ?? (upstream?.detached ? "detached" : "unborn");

  const pullTooltip = !hasUpstream
    ? `${branchLabel} has no upstream`
    : behind > 0
      ? `Pull ${behind} commit${behind === 1 ? "" : "s"} from ${upstreamLabel} (ff-only)`
      : `Up to date with ${upstreamLabel}`;

  const pushTooltip = !hasUpstream
    ? `Publish ${branchLabel} (sets upstream)`
    : ahead > 0
      ? `Push ${ahead} commit${ahead === 1 ? "" : "s"} to ${upstreamLabel}`
      : `Nothing to push to ${upstreamLabel}`;

  return (
    <ButtonGroup>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2"
            disabled={anyPending}
            onClick={() => fetchOp.mutate({})}
            aria-label="Fetch"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", fetchOp.isPending && "animate-spin")} />
            <span className="text-xs">Fetch</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>Fetch all remotes (prune)</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2"
            disabled={anyPending || !hasUpstream || behind === 0}
            onClick={() => pullOp.mutate({})}
            aria-label="Pull"
          >
            <ArrowDown className="h-3.5 w-3.5" />
            <span className="text-xs tabular-nums">{behind > 0 ? behind : "Pull"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pullTooltip}</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 px-2"
            disabled={anyPending || (hasUpstream && ahead === 0)}
            onClick={() => pushOp.mutate(hasUpstream ? {} : { setUpstream: true })}
            aria-label="Push"
          >
            <ArrowUp className="h-3.5 w-3.5" />
            <span className="text-xs tabular-nums">{ahead > 0 ? ahead : "Push"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{pushTooltip}</TooltipContent>
      </Tooltip>
    </ButtonGroup>
  );
}
