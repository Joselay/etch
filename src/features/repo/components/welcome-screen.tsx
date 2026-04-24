import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  Cloud,
  FolderGit2,
  GitBranch,
  GitCommitHorizontal,
  Plus,
  Settings,
  Sparkles,
  Workflow,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRepoStore } from "@/stores/repo-store";
import { useUiStore } from "@/stores/ui-store";
import pkg from "../../../../package.json";
import { useCloneRepo, useInitRepo } from "../hooks/use-clone-repo";
import { useOpenRepo } from "../hooks/use-open-repo";
import { CloneDialog } from "./clone-dialog";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(ts).toLocaleDateString();
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

export function WelcomeScreen() {
  const { pickAndOpen, openAt, isOpening, error } = useOpenRepo();
  const { initAt, isInitializing } = useInitRepo();
  const { isCloning } = useCloneRepo();
  const recents = useRepoStore((s) => s.recentRepos);
  const removeRecent = useRepoStore((s) => s.removeRecent);
  const hydrate = useRepoStore((s) => s.hydrate);
  const openSettings = useUiStore((s) => s.openSettings);
  const [cloneOpen, setCloneOpen] = useState(false);

  const pickAndInit = useCallback(async () => {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      try {
        await initAt(selected);
      } catch {
        // toast already shown
      }
    }
  }, [initAt]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      const key = e.key.toLowerCase();

      if (key === "o" && !e.shiftKey) {
        e.preventDefault();
        void pickAndOpen();
      } else if (key === "o" && e.shiftKey) {
        e.preventDefault();
        setCloneOpen(true);
      } else if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        void pickAndInit();
      } else if (e.key === ",") {
        e.preventDefault();
        openSettings();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pickAndOpen, pickAndInit, openSettings]);

  const hasRecents = recents.length > 0;

  const recentsList = useMemo(
    () =>
      recents.map((r) => {
        const name = r.path.split(/[\\/]/).filter(Boolean).pop() ?? r.path;
        return { ...r, name };
      }),
    [recents],
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--color-muted)_0%,_transparent_55%)] opacity-60"
      />

      <div className="absolute right-4 top-4 z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="icon" variant="ghost" onClick={openSettings} aria-label="Settings">
              <Settings className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <span className="flex items-center gap-2">
              Settings
              <KbdGroup>
                <Kbd>{modKey}</Kbd>
                <Kbd>,</Kbd>
              </KbdGroup>
            </span>
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="relative mx-auto flex max-w-4xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col items-center gap-4 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 ring-1 ring-border shadow-sm">
            <GitBranch className="h-7 w-7 text-primary" strokeWidth={2.25} />
          </div>
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />v{pkg.version} · early access
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight">
            Welcome to <span className="font-bold">Loom</span>
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground">
            A fast, native git client for macOS &amp; Windows — built to make branching, committing,
            and reviewing code feel effortless.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="lg" onClick={() => void pickAndOpen()} disabled={isOpening}>
                  {isOpening ? <Spinner /> : <FolderGit2 />}
                  {isOpening ? "Opening…" : "Open repository"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <KbdGroup>
                  <Kbd>{modKey}</Kbd>
                  <Kbd>O</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => setCloneOpen(true)}
                  disabled={isCloning}
                >
                  {isCloning ? <Spinner /> : <Plus />}
                  {isCloning ? "Cloning…" : "Clone from URL"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <KbdGroup>
                  <Kbd>{modKey}</Kbd>
                  <Kbd>⇧</Kbd>
                  <Kbd>O</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => void pickAndInit()}
                  disabled={isInitializing}
                >
                  {isInitializing ? <Spinner /> : <Workflow />}
                  {isInitializing ? "Initializing…" : "New repository"}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <KbdGroup>
                  <Kbd>{modKey}</Kbd>
                  <Kbd>N</Kbd>
                </KbdGroup>
              </TooltipContent>
            </Tooltip>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </header>

        <Separator />

        {hasRecents ? (
          <>
            <section>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                  Recent
                </h2>
                <span className="text-xs text-muted-foreground">
                  {recents.length} {recents.length === 1 ? "repository" : "repositories"}
                </span>
              </div>
              <ItemGroup>
                {recentsList.map((r) => (
                  <Item
                    key={r.path}
                    variant="outline"
                    size="sm"
                    className="group cursor-pointer transition-colors hover:bg-accent/60"
                    onClick={() => void openAt(r.path)}
                  >
                    <ItemMedia variant="icon">
                      <FolderGit2 />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{r.name}</ItemTitle>
                      <ItemDescription className="truncate" title={r.path}>
                        {r.path}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions className="items-center gap-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {relativeTime(r.lastOpenedAt)}
                      </span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              void removeRecent(r.path);
                            }}
                            aria-label={`Remove ${r.name} from recents`}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Remove from recents</TooltipContent>
                      </Tooltip>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={<GitBranch className="h-5 w-5 text-muted-foreground" />}
                title="Visual branching"
                description="See your branch graph the way you think about it."
              />
              <FeatureCard
                icon={<GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />}
                title="Stage line by line"
                description="Craft clean commits without leaving the diff."
              />
              <FeatureCard
                icon={<Cloud className="h-5 w-5 text-muted-foreground" />}
                title="GitHub native"
                description="PRs, reviews, and checks — all in one place."
              />
            </section>
          </>
        ) : (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <FeatureCard
                icon={<GitBranch className="h-5 w-5 text-muted-foreground" />}
                title="Visual branching"
                description="See your branch graph the way you think about it."
              />
              <FeatureCard
                icon={<GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />}
                title="Stage line by line"
                description="Craft clean commits without leaving the diff."
              />
              <FeatureCard
                icon={<Cloud className="h-5 w-5 text-muted-foreground" />}
                title="GitHub native"
                description="PRs, reviews, and checks — all in one place."
              />
            </section>

            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FolderGit2 />
                </EmptyMedia>
                <EmptyTitle>No recent repositories</EmptyTitle>
                <EmptyDescription>
                  Open a local folder, clone a remote, or start fresh — your recents will appear
                  here.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </>
        )}
      </div>

      <CloneDialog open={cloneOpen} onOpenChange={setCloneOpen} />
    </main>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="transition-colors hover:border-foreground/20">
      <CardHeader>
        {icon}
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}
