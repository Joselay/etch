export type MenuEventName =
  | "new-repo"
  | "open-repo"
  | "clone-repo"
  | "close-repo"
  | "settings"
  | "view-history"
  | "view-changes"
  | "command-palette"
  | "toggle-word-wrap"
  | "toggle-line-numbers"
  | "fetch"
  | "pull"
  | "push"
  | "new-branch"
  | "new-tag"
  | "create-stash";

export const MENU_EVENTS: readonly MenuEventName[] = [
  "new-repo",
  "open-repo",
  "clone-repo",
  "close-repo",
  "settings",
  "view-history",
  "view-changes",
  "command-palette",
  "toggle-word-wrap",
  "toggle-line-numbers",
  "fetch",
  "pull",
  "push",
  "new-branch",
  "new-tag",
  "create-stash",
] as const;

const PREFIX = "etch:menu:";

export function dispatchMenuEvent(name: MenuEventName): void {
  window.dispatchEvent(new CustomEvent(`${PREFIX}${name}`));
}

export function onMenuEvent(name: MenuEventName, handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(`${PREFIX}${name}`, listener);
  return () => window.removeEventListener(`${PREFIX}${name}`, listener);
}
