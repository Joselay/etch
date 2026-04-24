import {
  ArrowDown,
  ArrowUp,
  GitBranch,
  GitMerge,
  History,
  Keyboard,
  Pencil,
  RefreshCw,
  Settings,
} from "lucide-react";
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
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useCheckout } from "../hooks/use-branch-mutations";
import { useRefs } from "../hooks/use-refs";
import { useFetch, usePull, usePush, useUpstreamStatus } from "../hooks/use-remote-ops";

export function CommandPalette() {
  const open = useUiStore((s) => s.paletteOpen);
  const setOpen = useUiStore((s) => s.setPaletteOpen);
  const allBranches = useUiStore((s) => s.commitLogAllBranches);
  const toggleAllBranches = useUiStore((s) => s.toggleCommitLogAllBranches);
  const openSettings = useUiStore((s) => s.openSettings);
  const openShortcuts = useUiStore((s) => s.openShortcuts);
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const setView = useSelectionStore((s) => s.setView);

  const path = activeRepo?.path ?? null;
  const { data: refs } = useRefs(path);
  const { data: upstream } = useUpstreamStatus(path);

  // Mutations — instantiated unconditionally; inert when no active repo.
  const checkout = useCheckout(path ?? "");
  const fetchOp = useFetch(path ?? "");
  const pullOp = usePull(path ?? "");
  const pushOp = usePush(path ?? "");

  const branches = useMemo(() => refs?.local ?? [], [refs]);
  const currentBranch = upstream?.branch ?? null;

  const close = () => setOpen(false);
  const run = (fn: () => void) => {
    close();
    fn();
  };

  if (!activeRepo) return null;

  const hasUpstream = !!upstream?.upstream;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search commands, branches…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem
            keywords={["history", "log", "commits"]}
            onSelect={() => run(() => setView("history"))}
          >
            <History />
            History
            <CommandShortcut>⌘1</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["changes", "staging", "working"]}
            onSelect={() => run(() => setView("changes"))}
          >
            <Pencil />
            Changes
            <CommandShortcut>⌘2</CommandShortcut>
          </CommandItem>
          <CommandItem
            keywords={["history", "scope", "branches", "all"]}
            onSelect={() => run(() => toggleAllBranches())}
          >
            <GitMerge />
            {allBranches ? "Show current branch only" : "Show all branches"}
            <CommandShortcut>⌘⇧B</CommandShortcut>
          </CommandItem>
          <CommandItem keywords={["preferences"]} onSelect={() => run(() => openSettings())}>
            <Settings />
            Open settings
          </CommandItem>
          <CommandItem
            keywords={["shortcuts", "keyboard", "cheatsheet", "help"]}
            onSelect={() => run(() => openShortcuts())}
          >
            <Keyboard />
            Keyboard shortcuts
            <CommandShortcut>?</CommandShortcut>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Remote">
          <CommandItem onSelect={() => run(() => fetchOp.mutate({}))}>
            <RefreshCw />
            Fetch
          </CommandItem>
          <CommandItem
            disabled={!hasUpstream || (upstream?.behind ?? 0) === 0}
            onSelect={() => run(() => pullOp.mutate({}))}
          >
            <ArrowDown />
            Pull{upstream?.behind ? ` (${upstream.behind})` : ""}
          </CommandItem>
          <CommandItem
            disabled={hasUpstream && (upstream?.ahead ?? 0) === 0}
            onSelect={() => run(() => pushOp.mutate(hasUpstream ? {} : { setUpstream: true }))}
          >
            <ArrowUp />
            {hasUpstream
              ? `Push${upstream?.ahead ? ` (${upstream.ahead})` : ""}`
              : "Publish branch"}
          </CommandItem>
        </CommandGroup>

        {branches.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Switch branch">
              {branches.map((b) => (
                <CommandItem
                  key={b.fullName}
                  value={`branch:${b.name}`}
                  keywords={[b.name, "checkout", "switch"]}
                  disabled={b.name === currentBranch}
                  onSelect={() => run(() => checkout.mutate({ target: b.name, create: false }))}
                >
                  <GitBranch />
                  {b.name}
                  {b.name === currentBranch && <CommandShortcut>current</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
