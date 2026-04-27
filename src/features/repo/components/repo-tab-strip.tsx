import { GitBranch, X } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoTabStrip() {
  const openRepos = useRepoStore((s) => s.openRepos);
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const welcomeTabOpen = useRepoStore((s) => s.welcomeTabOpen);
  const recentRepos = useRepoStore((s) => s.recentRepos);
  const setActivePath = useRepoStore((s) => s.setActivePath);
  const closeRepo = useRepoStore((s) => s.closeRepo);
  const openWelcomeTab = useRepoStore((s) => s.openWelcomeTab);
  const closeWelcomeTab = useRepoStore((s) => s.closeWelcomeTab);
  const removeTab = useSelectionStore((s) => s.removeTab);

  const closeRepoTab = async (path: string) => {
    removeTab(path);
    await closeRepo(path);
  };

  const welcomeIsActive = welcomeTabOpen && activeRepo === null;

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b bg-muted/30",
        isMac && "pl-[78px]",
      )}
    >
      {openRepos.map((r) => {
        const folder = r.path.split(/[\\/]/).filter(Boolean).pop() ?? r.path;
        const isActive = r.path === activeRepo?.path;
        const remoteUrl = recentRepos.find((rec) => rec.path === r.path)?.remoteUrl ?? null;
        return (
          <div
            key={r.path}
            className={cn(
              "group/tab relative flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
              isActive ? "bg-background" : "hover:bg-background/60",
            )}
          >
            <button
              type="button"
              onClick={() => setActivePath(r.path)}
              className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
              title={r.path}
            >
              <ProviderIcon url={remoteUrl} className="h-3 w-3" />
              <span className="truncate">{folder}</span>
            </button>
            <button
              type="button"
              aria-label={`Close ${folder}`}
              onClick={() => void closeRepoTab(r.path)}
              className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100 data-[active=true]:opacity-100"
              data-active={isActive}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      {welcomeTabOpen && (
        <div
          className={cn(
            "group/tab relative flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
            welcomeIsActive ? "bg-background" : "hover:bg-background/60",
          )}
        >
          <button
            type="button"
            onClick={() => void openWelcomeTab()}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
            title="Welcome"
          >
            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">New Tab</span>
          </button>
          <button
            type="button"
            aria-label="Close New Tab"
            onClick={() => void closeWelcomeTab()}
            className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100 data-[active=true]:opacity-100"
            data-active={welcomeIsActive}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}
