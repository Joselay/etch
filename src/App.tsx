import { Cloud, FolderGit2, GitBranch, GitCommitHorizontal, Plus, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import "./App.css";

function App() {
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
            A fast, native git client for macOS — built to make branching,
            committing, and reviewing code feel effortless.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="lg">
              <FolderGit2 />
              Open repository
            </Button>
            <Button size="lg" variant="outline">
              <Plus />
              Clone from URL
            </Button>
          </div>
        </header>

        <Separator />

        <section className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <GitBranch className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">Visual branching</CardTitle>
              <CardDescription>
                See your branch graph the way you think about it.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <GitCommitHorizontal className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">Stage line by line</CardTitle>
              <CardDescription>
                Craft clean commits without leaving the diff.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <Cloud className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="mt-2">GitHub native</CardTitle>
              <CardDescription>
                PRs, reviews, and checks — all in one place.
              </CardDescription>
            </CardHeader>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>No recent repositories</CardTitle>
            <CardDescription>
              Open a local folder or clone a repo to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm">
                <FolderGit2 />
                Open local folder
              </Button>
              <Button variant="secondary" size="sm">
                <Cloud />
                Sign in with GitHub
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;
