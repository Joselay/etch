import { ChevronRight, Folder, FolderOpen } from "lucide-react";
import { type ReactNode, useState } from "react";
import { buildFileTree, type FileTreeNode } from "@/lib/file-tree";
import { cn } from "@/lib/utils";

export const TREE_INDENT_PX = 20;
export const TREE_GUTTER_PX = 10;

type RenderItemArgs = {
  depth: number;
  displayName: string;
  indentPx: number;
};

type Props<T extends { path: string }> = {
  items: T[];
  renderItem: (item: T, args: RenderItemArgs) => ReactNode;
  indentPx?: number;
};

export function FileTree<T extends { path: string }>({
  items,
  renderItem,
  indentPx = TREE_INDENT_PX,
}: Props<T>) {
  const nodes = buildFileTree(items);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <div className="flex flex-col py-0.5">
      {nodes.map((n) => (
        <TreeNode
          key={n.path}
          node={n}
          collapsed={collapsed}
          onToggle={toggle}
          renderItem={renderItem}
          indentPx={indentPx}
        />
      ))}
    </div>
  );
}

function TreeNode<T extends { path: string }>({
  node,
  collapsed,
  onToggle,
  renderItem,
  indentPx,
}: {
  node: FileTreeNode<T>;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  renderItem: (item: T, args: RenderItemArgs) => ReactNode;
  indentPx: number;
}) {
  if (node.entry) {
    return <>{renderItem(node.entry, { depth: node.depth, displayName: node.name, indentPx })}</>;
  }

  const isCollapsed = collapsed.has(node.path);
  return (
    <>
      <FolderRow
        name={node.name}
        depth={node.depth}
        collapsed={isCollapsed}
        onToggle={() => onToggle(node.path)}
        indentPx={indentPx}
      />
      {!isCollapsed &&
        node.children.map((c) => (
          <TreeNode
            key={c.path}
            node={c}
            collapsed={collapsed}
            onToggle={onToggle}
            renderItem={renderItem}
            indentPx={indentPx}
          />
        ))}
    </>
  );
}

/**
 * Placeholder matching the chevron's footprint in folder rows. Render this
 * inside leaf rows (files) so their icons align under the parent folder's
 * name rather than under the parent folder's icon.
 */
export function TreeLeafSpacer() {
  return <span aria-hidden className="h-3.5 w-3.5 shrink-0" />;
}

/**
 * Vertical guide lines that visually connect siblings under a parent folder.
 * Rendered inside tree rows so guides stretch to the row's full height.
 */
export function TreeIndentGuides({
  depth,
  indentPx = TREE_INDENT_PX,
}: {
  depth: number;
  indentPx?: number;
}) {
  return (
    <div className="flex shrink-0 self-stretch" aria-hidden>
      <div style={{ width: TREE_GUTTER_PX }} />
      {Array.from({ length: depth }).map((_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: positional guides
          key={i}
          style={{ width: indentPx }}
          className="border-border/50 border-l"
        />
      ))}
    </div>
  );
}

function FolderRow({
  name,
  depth,
  collapsed,
  onToggle,
  indentPx,
}: {
  name: string;
  depth: number;
  collapsed: boolean;
  onToggle: () => void;
  indentPx: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="group flex w-full min-w-0 items-stretch text-[13px] text-foreground/85 hover:bg-muted/60 hover:text-foreground"
    >
      <TreeIndentGuides depth={depth} indentPx={indentPx} />
      <div className="flex min-w-0 flex-1 items-center gap-1.5 py-1 pr-3">
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform",
            !collapsed && "rotate-90",
          )}
        />
        {collapsed ? (
          <Folder className="h-3.5 w-3.5 shrink-0 fill-sky-500/25 text-sky-500" />
        ) : (
          <FolderOpen className="h-3.5 w-3.5 shrink-0 fill-sky-500/25 text-sky-500" />
        )}
        <span className="truncate font-medium tracking-tight">{name}</span>
      </div>
    </button>
  );
}
