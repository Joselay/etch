import { Fragment, type ReactNode, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { type Command, useCommands } from "@/lib/command-registry";
import { formatShortcutKey } from "@/lib/shortcut-format";
import { useModalStore } from "@/stores/modal-store";

type Item = {
  label: string;
  // Either a single shortcut, or a list of shortcuts shown side-by-side
  // (used to fold the 9 tab-switch bindings into one row).
  shortcuts: string[][];
};

export function ShortcutsDialog() {
  const open = useModalStore((s) => s.shortcutsOpen);
  const setOpen = useModalStore((s) => s.setShortcutsOpen);
  const commands = useCommands();

  // Build sections from the same registry the palette uses. Anything without
  // a shortcut is hidden — the cheat sheet is for keyboard-addressable ops.
  const sections = useMemo(() => {
    const byGroup = new Map<string, Item[]>();
    const tabSwitchKeys: string[][] = [];
    for (const cmd of commands) {
      if (!cmd.shortcut) continue;
      if (isTabSwitchCommand(cmd)) {
        tabSwitchKeys.push(cmd.shortcut.keys);
        continue;
      }
      const list = byGroup.get(cmd.group) ?? [];
      list.push({ label: cmd.label, shortcuts: [cmd.shortcut.keys] });
      byGroup.set(cmd.group, list);
    }
    if (tabSwitchKeys.length > 0) {
      // Fold ⌘1, ⌘2, … ⌘9 into a single "Switch to tab" entry rendered as
      // ⌘1 … ⌘9 (two key caps joined by an ellipsis).
      const endpoints = tabRangeEndpoints(tabSwitchKeys);
      const list = byGroup.get("Repository") ?? [];
      const newTabIdx = list.findIndex((i) => i.label === "New tab");
      const entry: Item = { label: "Switch to tab", shortcuts: endpoints };
      if (newTabIdx >= 0) list.splice(newTabIdx + 1, 0, entry);
      else list.unshift(entry);
      byGroup.set("Repository", list);
    }
    return [...byGroup.entries()].map(([heading, items]) => ({ heading, items }));
  }, [commands]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> any time to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] gap-x-8 overflow-y-auto pr-1 sm:columns-2">
          {sections.map((section) => (
            <section key={section.heading} className="mb-6 flex break-inside-avoid flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.heading}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <ShortcutDisplay shortcuts={item.shortcuts} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutDisplay({ shortcuts }: { shortcuts: string[][] }) {
  return (
    <KbdGroup>
      {shortcuts.map((keys, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: shortcuts list is fixed per render
        <Fragment key={idx}>
          {idx > 0 ? <span className="px-0.5 text-muted-foreground">…</span> : null}
          {keys.map((k, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: tokens repeat across rows
            <Kbd key={`${idx}-${j}`}>{renderToken(k)}</Kbd>
          ))}
        </Fragment>
      ))}
    </KbdGroup>
  );
}

function renderToken(token: string): ReactNode {
  return formatShortcutKey(token);
}

function isTabSwitchCommand(cmd: Command): boolean {
  return cmd.id.startsWith("tab.switch");
}

// Given the 9 tab-switch shortcuts ([mod, "1"]..[mod, "9"]), return the two
// endpoints so the dialog can render ⌘1 … ⌘9 as a pair of key caps.
function tabRangeEndpoints(all: string[][]): string[][] {
  const numbers = all
    .map((keys) => keys[keys.length - 1])
    .filter((k): k is string => !!k && /^\d$/.test(k))
    .map((k) => Number(k))
    .sort((a, b) => a - b);
  const modifiers = all[0]?.slice(0, -1) ?? ["mod"];
  if (numbers.length <= 1) {
    return [[...modifiers, String(numbers[0] ?? 1)]];
  }
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  return [
    [...modifiers, String(first)],
    [...modifiers, String(last)],
  ];
}
