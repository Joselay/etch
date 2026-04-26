import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useGitignore, useWriteGitignore } from "@/features/repo/hooks/use-gitignore";

export function GitignoreEditor({ repoPath }: { repoPath: string }) {
  const { data, isLoading } = useGitignore(repoPath);
  const write = useWriteGitignore(repoPath);
  const [draft, setDraft] = useState("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && data !== undefined) {
      setDraft(data);
      setHydrated(true);
    }
  }, [data, hydrated]);

  const dirty = hydrated && draft !== (data ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">.gitignore</h3>
        <p className="text-xs text-muted-foreground">
          Patterns are matched against paths relative to the repository root. One pattern per line.
        </p>
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={isLoading ? "Loading…" : "node_modules/\n*.log\n.DS_Store"}
        spellCheck={false}
        className="min-h-[260px] font-mono text-xs"
        disabled={isLoading || write.isPending}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDraft(data ?? "")}
          disabled={!dirty || write.isPending}
        >
          Reset
        </Button>
        <Button size="sm" onClick={() => write.mutate(draft)} disabled={!dirty || write.isPending}>
          {write.isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
