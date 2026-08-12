import { formatDistanceToNow } from "date-fns";
import { FolderGit2, GitCommitHorizontal, RefreshCw, X } from "lucide-react";
import { useMemo } from "react";
import etchLogo from "@/assets/etch-logo.png";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { useOpenRepo } from "../hooks/use-open-repo";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function WelcomeScreen() {
  const { pickAndOpen, openAt, isOpening, error } = useOpenRepo();
  const recents = useRepoStore((state) => state.recentRepos);
  const removeRecent = useRepoStore((state) => state.removeRecent);

  const recentItems = useMemo(
    () =>
      recents.map((repo) => ({
        ...repo,
        name: repo.path.split(/[\\/]/).filter(Boolean).pop() ?? repo.path,
      })),
    [recents],
  );

  return (
    <main className="relative h-full min-h-0 flex-1 overflow-y-auto bg-background text-foreground">
      <div
        data-tauri-drag-region
        aria-hidden
        className={cn("absolute inset-x-0 top-0 z-20", isMac ? "h-8" : "h-6")}
      />
      <div className={cn("absolute right-4 z-30", isMac ? "top-10" : "top-4")}>
        <ThemeToggle />
      </div>
      <div
        className={cn(
          "relative mx-auto flex max-w-3xl flex-col gap-8 px-6 pb-16",
          isMac ? "pt-20" : "pt-16",
        )}
      >
        <header className="flex flex-col items-center gap-4 text-center">
          <img
            src={etchLogo}
            alt="Etch"
            className="h-16 w-16 rounded-2xl object-cover shadow-sm ring-1 ring-border"
          />
          <h1 className="text-4xl font-semibold tracking-tight">Etch</h1>
          <p className="max-w-lg text-balance text-muted-foreground">
            Browse local Git history and inspect committed or uncommitted changes without modifying
            your repository.
          </p>
          <Button size="lg" onClick={() => void pickAndOpen()} disabled={isOpening}>
            {isOpening ? <Spinner /> : <FolderGit2 />}
            {isOpening ? "Opening…" : "Open local repository"}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </header>

        <Separator />

        {recentItems.length > 0 ? (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Recent repositories
              </h2>
              <span className="text-xs text-muted-foreground">{recentItems.length}</span>
            </div>
            <ItemGroup>
              {recentItems.map((repo) => (
                <Item
                  key={repo.path}
                  variant="outline"
                  size="sm"
                  className="group cursor-pointer transition-colors hover:bg-accent/60"
                  onClick={() => void openAt(repo.path)}
                >
                  <ItemMedia variant="icon">
                    <FolderGit2 />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{repo.name}</ItemTitle>
                    <ItemDescription className="truncate" title={repo.path}>
                      {repo.path}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions className="items-center gap-1">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {formatDistanceToNow(new Date(repo.lastOpenedAt), { addSuffix: true })}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                          onClick={(event) => {
                            event.stopPropagation();
                            void removeRecent(repo.path);
                          }}
                          aria-label={`Remove ${repo.name} from recents`}
                        >
                          <X />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Remove from recents</TooltipContent>
                    </Tooltip>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </section>
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <GitCommitHorizontal />
              </EmptyMedia>
              <EmptyTitle>No recent repositories</EmptyTitle>
              <EmptyDescription>
                Open a local repository to inspect its history and working tree.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh at any time with {isMac ? "⌘R" : "Ctrl+R"} or F5.
        </div>
      </div>
    </main>
  );
}
