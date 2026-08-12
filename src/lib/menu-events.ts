export type MenuEventName =
  | "open-repo"
  | "new-tab"
  | "close-repo"
  | "view-history"
  | "view-changes"
  | "toggle-word-wrap"
  | "toggle-line-numbers";

export const MENU_EVENTS: readonly MenuEventName[] = [
  "open-repo",
  "new-tab",
  "close-repo",
  "view-history",
  "view-changes",
  "toggle-word-wrap",
  "toggle-line-numbers",
];

const PREFIX = "etch:menu:";

export function dispatchMenuEvent(name: MenuEventName): void {
  window.dispatchEvent(new CustomEvent(`${PREFIX}${name}`));
}

export function onMenuEvent(name: MenuEventName, handler: () => void): () => void {
  const listener = () => handler();
  window.addEventListener(`${PREFIX}${name}`, listener);
  return () => window.removeEventListener(`${PREFIX}${name}`, listener);
}
