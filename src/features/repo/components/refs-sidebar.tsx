import { Check, GitBranch, Tag } from "lucide-react";
import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefs } from "../hooks/use-refs";

type Props = { repoPath: string };

export function RefsSidebar({ repoPath }: Props) {
  const { data, isLoading, error } = useRefs(repoPath);

  const remoteGroups = useMemo(() => {
    const map = new Map<string, { name: string; fullName: string; target: string | null }[]>();
    if (!data) return map;
    for (const r of data.remote) {
      const key = r.remote ?? "origin";
      const arr = map.get(key) ?? [];
      arr.push({ name: r.name, fullName: r.fullName, target: r.target });
      map.set(key, arr);
    }
    return map;
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-3">
        {["s1", "s2", "s3", "s4"].map((k) => (
          <Skeleton key={k} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-3 text-xs text-destructive">{(error as Error).message}</div>;
  }

  if (!data) return null;

  return (
    <div className="flex flex-col gap-4 overflow-auto p-3 text-sm">
      <Section title="Branches" icon={<GitBranch className="h-3.5 w-3.5" />}>
        {data.local.length === 0 ? (
          <Empty>No local branches</Empty>
        ) : (
          data.local.map((b) => (
            <Row key={b.fullName}>
              {b.isHead ? <Check className="h-3 w-3 text-primary" /> : <span className="w-3" />}
              <span className={b.isHead ? "font-medium" : ""}>{b.name}</span>
            </Row>
          ))
        )}
      </Section>

      {remoteGroups.size > 0 && (
        <Section title="Remotes" icon={<GitBranch className="h-3.5 w-3.5" />}>
          {[...remoteGroups.entries()].map(([remote, branches]) => (
            <div key={remote} className="flex flex-col gap-0.5">
              <div className="px-1 text-xs font-medium text-muted-foreground">{remote}</div>
              {branches.map((b) => (
                <Row key={b.fullName}>
                  <span className="w-3" />
                  <span className="truncate">{b.name}</span>
                </Row>
              ))}
            </div>
          ))}
        </Section>
      )}

      {data.tags.length > 0 && (
        <Section title="Tags" icon={<Tag className="h-3.5 w-3.5" />}>
          {data.tags.map((t) => (
            <Row key={t.fullName}>
              <span className="w-3" />
              <span className="truncate">{t.name}</span>
            </Row>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-muted/60">
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-1.5 text-xs text-muted-foreground">{children}</div>;
}
