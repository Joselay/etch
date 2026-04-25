// Render a `CommandShortcut`'s tokens into platform-appropriate symbols.

import type { ReactNode } from "react";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform || "");

const MAC: Record<string, string> = {
  mod: "⌘",
  shift: "⇧",
  alt: "⌥",
  ctrl: "⌃",
  enter: "↵",
  esc: "⎋",
  tab: "⇥",
};

const WIN: Record<string, string> = {
  mod: "Ctrl",
  shift: "Shift",
  alt: "Alt",
  ctrl: "Ctrl",
  enter: "Enter",
  esc: "Esc",
  tab: "Tab",
};

export function formatShortcutKey(token: string): string {
  const lower = token.toLowerCase();
  const map = isMac ? MAC : WIN;
  if (lower in map) return map[lower];
  // Already-rendered symbols pass through unchanged.
  if (token.length === 1) return token.toUpperCase();
  return token;
}

export function shortcutToString(keys: string[]): string {
  return keys.map(formatShortcutKey).join(isMac ? "" : "+");
}

export function ShortcutKeys({
  keys,
  render,
}: {
  keys: string[];
  render: (rendered: string, raw: string, idx: number) => ReactNode;
}) {
  return <>{keys.map((k, i) => render(formatShortcutKey(k), k, i))}</>;
}
