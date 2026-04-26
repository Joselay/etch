import { useEffect } from "react";
import { type Command, useCommands } from "@/lib/command-registry";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

function matchesShortcut(keys: string[], e: KeyboardEvent): boolean {
  const wantMod = keys.includes("mod");
  const wantShift = keys.includes("shift");
  const wantAlt = keys.includes("alt");
  const wantCtrl = keys.includes("ctrl");
  const main = keys[keys.length - 1]?.toLowerCase();
  if (!main) return false;

  if (wantMod !== (e.metaKey || e.ctrlKey)) return false;
  if (wantAlt !== e.altKey) return false;
  // `ctrl` is literal (distinct from `mod`); only enforce when explicitly requested.
  if (wantCtrl && !e.ctrlKey) return false;

  // Shift state is only meaningful for letter/digit keys — for symbol keys
  // (?, /, :, !, …) the shift is implicit in producing the character, so we
  // skip the equality check unless the registry explicitly listed `shift`.
  const isAlnum = main.length === 1 && /[a-z0-9]/.test(main);
  if (isAlnum) {
    if (wantShift !== e.shiftKey) return false;
  } else if (wantShift && !e.shiftKey) {
    return false;
  }

  const key = e.key.toLowerCase();
  if (main === "enter" || main === "↵") return key === "enter";
  if (main === "esc") return key === "escape";
  if (main === "tab") return key === "tab";
  if (main === "space") return key === " ";
  return key === main;
}

function hasModifier(keys: string[]): boolean {
  return keys.some((k) => k === "mod" || k === "ctrl" || k === "alt");
}

function isRunnable(
  cmd: Command,
): cmd is Command & { shortcut: { keys: string[] }; run: () => void } {
  // shortcutOnly is fine to dispatch as long as a `run` exists — the flag only
  // hides the command from the palette listing, not from the global keymap.
  return !!cmd.shortcut && !!cmd.run && !cmd.disabled;
}

export function useCommandShortcuts() {
  const commands = useCommands();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      for (const cmd of commands) {
        if (!isRunnable(cmd)) continue;
        const keys = cmd.shortcut.keys;
        // Single-key shortcuts (no modifier) would steal characters from text
        // inputs — only fire them when the user isn't typing.
        if (typing && !hasModifier(keys)) continue;
        if (!matchesShortcut(keys, e)) continue;
        e.preventDefault();
        e.stopPropagation();
        cmd.run();
        return;
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [commands]);
}
