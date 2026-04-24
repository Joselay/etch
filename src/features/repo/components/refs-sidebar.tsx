import { Check, ChevronRight, GitBranch, Tag } from "lucide-react";
import { useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Item, ItemContent, ItemGroup, ItemMedia, ItemTitle } from "@/components/ui/item";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-1 p-2">
        <Section title="Branches" icon={<GitBranch className="h-3.5 w-3.5" />}>
          {data.local.length === 0 ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">No local branches</div>
          ) : (
            <ItemGroup>
              {data.local.map((b) => (
                <RefItem
                  key={b.fullName}
                  icon={b.isHead ? <Check className="h-3 w-3 text-primary" /> : null}
                  label={b.name}
                  emphasized={b.isHead}
                />
              ))}
            </ItemGroup>
          )}
        </Section>

        {remoteGroups.size > 0 && (
          <Section title="Remotes" icon={<GitBranch className="h-3.5 w-3.5" />}>
            {[...remoteGroups.entries()].map(([remote, branches]) => (
              <div key={remote} className="flex flex-col gap-0.5">
                <div className="px-2 pt-1 text-xs font-medium text-muted-foreground">{remote}</div>
                <ItemGroup>
                  {branches.map((b) => (
                    <RefItem key={b.fullName} label={b.name} />
                  ))}
                </ItemGroup>
              </div>
            ))}
          </Section>
        )}

        {data.tags.length > 0 && (
          <Section title="Tags" icon={<Tag className="h-3.5 w-3.5" />}>
            <ItemGroup>
              {data.tags.map((t) => (
                <RefItem key={t.fullName} label={t.name} />
              ))}
            </ItemGroup>
          </Section>
        )}
      </div>
    </ScrollArea>
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
    <Collapsible defaultOpen className="flex flex-col gap-1">
      <CollapsibleTrigger className="group flex items-center gap-1.5 rounded px-1.5 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-muted/60">
        <ChevronRight className="h-3 w-3 transition-transform group-data-[state=open]:rotate-90" />
        {icon}
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function RefItem({
  icon,
  label,
  emphasized,
}: {
  icon?: React.ReactNode;
  label: string;
  emphasized?: boolean;
}) {
  return (
    <Item
      size="sm"
      variant="muted"
      className="cursor-default rounded-sm border-0 bg-transparent px-2 py-1"
    >
      <ItemMedia className="w-3">{icon}</ItemMedia>
      <ItemContent>
        <ItemTitle className={emphasized ? "text-sm font-medium" : "text-sm font-normal"}>
          {label}
        </ItemTitle>
      </ItemContent>
    </Item>
  );
}
