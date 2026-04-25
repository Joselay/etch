import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useCommands } from "@/lib/command-registry";
import { formatShortcutKey } from "@/lib/shortcut-format";
import { useUiStore } from "@/stores/ui-store";

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const commands = useCommands();

  // Build sections from the same registry the palette uses. Anything without
  // a shortcut is hidden — the cheat sheet is for keyboard-addressable ops.
  const sections = useMemo(() => {
    const byGroup = new Map<string, Array<{ label: string; keys: string[] }>>();
    for (const cmd of commands) {
      if (!cmd.shortcut) continue;
      const list = byGroup.get(cmd.group) ?? [];
      list.push({ label: cmd.label, keys: cmd.shortcut.keys });
      byGroup.set(cmd.group, list);
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
        <div className="grid max-h-[60vh] grid-cols-1 gap-x-8 gap-y-6 overflow-y-auto pr-1 sm:grid-cols-2">
          {sections.map((section) => (
            <section key={section.heading} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.heading}
              </h3>
              <ul className="flex flex-col gap-1.5">
                {section.items.map((item) => (
                  <li key={item.label} className="flex items-center justify-between gap-4 text-sm">
                    <span className="text-foreground">{item.label}</span>
                    <KbdGroup>
                      {item.keys.map((k) => (
                        <Kbd key={k}>{formatShortcutKey(k)}</Kbd>
                      ))}
                    </KbdGroup>
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
