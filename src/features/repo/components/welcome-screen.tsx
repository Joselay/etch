import { Cloud, FolderGit2, GitBranch, GitCommitHorizontal, Plus, Sparkles, X } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
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
import { useRepoStore } from "@/stores/repo-store";
import { useOpenRepo } from "../hooks/use-open-repo";

export function WelcomeScreen() {
  const { pickAndOpen, openAt, isOpening, error } = useOpenRepo();
  const recents = useRepoStore((s) => s.recentRepos);
  const removeRecent = useRepoStore((s) => s.removeRecent);
  const hydrate = useRepoStore((s) => s.hydrate);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-20">
        <header className="flex flex-col items-center gap-4 text-center">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3 w-3" />
            v0.1.0 · early access
          </Badge>
          <h1 className="text-5xl font-semibold tracking-tight">
            Welcome to <span className="font-bold">Loom</span>
          </h1>
          <p className="max-w-xl text-balance text-muted-foreground">
            A fast, native git client for macOS — built to make branching, committing, and reviewing
            code feel effortless.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="lg" onClick={() => void pickAndOpen()} disabled={isOpening}>
              <FolderGit2 />
              {isOpening ? "Opening…" : "Open repository"}
            </Button>
            <Button size="lg" variant="outline" disabled>
              <Plus />
              Clone from URL
            </Button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </header>

        <Separator />

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <GitBranch className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">Visual branching</CardTitle>
              <CardDescription>See your branch graph the way you think about it.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">Stage line by line</CardTitle>
              <CardDescription>Craft clean commits without leaving the diff.</CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">GitHub native</CardTitle>
              <CardDescription>PRs, reviews, and checks — all in one place.</CardDescription>
            </CardHeader>
          </Card>
        </section>

        {recents.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderGit2 />
              </EmptyMedia>
              <EmptyTitle>No recent repositories</EmptyTitle>
              <EmptyDescription>
                Open a local folder or clone a repo to get started.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void pickAndOpen()}
                  disabled={isOpening}
                >
                  <FolderGit2 />
                  Open local folder
                </Button>
                <Button variant="secondary" size="sm" disabled>
                  <Cloud />
                  Sign in with GitHub
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Recent</CardTitle>
              <CardDescription>Jump back into a recent repository.</CardDescription>
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {recents.map((r) => {
                  const name = r.path.split(/[\\/]/).filter(Boolean).pop() ?? r.path;
                  return (
                    <Item
                      key={r.path}
                      variant="outline"
                      size="sm"
                      className="cursor-pointer"
                      onClick={() => void openAt(r.path)}
                    >
                      <ItemMedia variant="icon">
                        <FolderGit2 />
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>{name}</ItemTitle>
                        <ItemDescription className="truncate">{r.path}</ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            void removeRecent(r.path);
                          }}
                          aria-label="Remove"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
