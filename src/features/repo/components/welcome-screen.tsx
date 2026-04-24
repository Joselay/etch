import { Cloud, FolderGit2, GitBranch, GitCommitHorizontal, Plus, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

        <Card>
          <CardHeader>
            <CardTitle>{recents.length === 0 ? "No recent repositories" : "Recent"}</CardTitle>
            <CardDescription>
              {recents.length === 0
                ? "Open a local folder or clone a repo to get started."
                : "Jump back into a recent repository."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recents.length === 0 ? (
              <div className="flex flex-wrap gap-2">
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
            ) : (
              <ul className="flex flex-col gap-1">
                {recents.map((r) => {
                  const name = r.path.split(/[\\/]/).filter(Boolean).pop() ?? r.path;
                  return (
                    <li
                      key={r.path}
                      className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 hover:bg-muted/60"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => void openAt(r.path)}
                        disabled={isOpening}
                      >
                        <div className="truncate text-sm font-medium">{name}</div>
                        <div className="truncate text-xs text-muted-foreground">{r.path}</div>
                      </button>
                      <Button size="sm" variant="ghost" onClick={() => void removeRecent(r.path)}>
                        Remove
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
