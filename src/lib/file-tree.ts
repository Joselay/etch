export type FileTreeNode<T> = {
  name: string;
  path: string;
  depth: number;
  children: FileTreeNode<T>[];
  entry?: T;
};

type Raw<T> = {
  name: string;
  path: string;
  children: Map<string, Raw<T>>;
  entry?: T;
};

export function buildFileTree<T extends { path: string }>(entries: T[]): FileTreeNode<T>[] {
  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const root: Raw<T> = { name: "", path: "", children: new Map() };

  for (const entry of sorted) {
    const parts = entry.path.split("/").filter(Boolean);
    let cur = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const childPath = cur.path ? `${cur.path}/${part}` : part;
      let child = cur.children.get(part);
      if (!child) {
        child = { name: part, path: childPath, children: new Map() };
        cur.children.set(part, child);
      }
      if (i === parts.length - 1) child.entry = entry;
      cur = child;
    }
  }

  const compact = (node: Raw<T>, depth: number): FileTreeNode<T> => {
    let cur = node;
    let name = node.name;
    while (!cur.entry && cur.children.size === 1) {
      const [onlyChild] = cur.children.values();
      if (onlyChild.entry) break;
      name = `${name}/${onlyChild.name}`;
      cur = onlyChild;
    }
    return {
      name,
      path: cur.path,
      depth,
      entry: cur.entry,
      children: Array.from(cur.children.values()).map((c) => compact(c, depth + 1)),
    };
  };

  return Array.from(root.children.values()).map((c) => compact(c, 0));
}
