import { useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useCommands } from "@/lib/command-registry";
import { shortcutToString } from "@/lib/shortcut-format";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";

export function CommandPalette() {
  const open = useModalStore((s) => s.paletteOpen);
  const setOpen = useModalStore((s) => s.setPaletteOpen);
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const commands = useCommands();

  // Group commands by their `group` field while preserving the order in which
  // each group first appeared in the registry. A flat fuzzy list with group
  // subtitles scales better than nested categories.
  const groups = useMemo(() => {
    const seen = new Map<string, typeof commands>();
    for (const cmd of commands) {
      if (cmd.shortcutOnly) continue;
      const list = seen.get(cmd.group) ?? [];
      list.push(cmd);
      seen.set(cmd.group, list);
    }
    return [...seen.entries()];
  }, [commands]);

  if (!activeRepo) return null;

  const close = () => setOpen(false);
  const run = (fn?: () => void) => {
    close();
    fn?.();
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, branches…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        {groups.map(([heading, items], idx) => (
          <div key={heading}>
            {idx > 0 && <CommandSeparator />}
            <CommandGroup heading={heading}>
              {items.map((cmd) => {
                const Icon = cmd.icon;
                const shortcutLabel = cmd.shortcut ? shortcutToString(cmd.shortcut.keys) : null;
                return (
                  <CommandItem
                    key={cmd.id}
                    value={`${cmd.id} ${cmd.label}`}
                    keywords={cmd.keywords}
                    disabled={cmd.disabled}
                    onSelect={() => run(cmd.run)}
                  >
                    {Icon && <Icon className="h-4 w-4" />}
                    {cmd.label}
                    {shortcutLabel && <CommandShortcut>{shortcutLabel}</CommandShortcut>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
