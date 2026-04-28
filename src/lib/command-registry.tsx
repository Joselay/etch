// Single source of truth for all keyboard-addressable commands. Both the
// command palette and the shortcuts dialog read from this hook so the two
// surfaces never drift. Dynamic items (branch checkout, upstream-aware
// remote ops) are derived from the same store/query data the rest of the
// app uses.

import {
  ArrowDown,
  ArrowUp,
  Columns2,
  Download,
  Eye,
  GitBranch,
  GitMerge,
  Hash,
  History,
  Keyboard,
  LogOut,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Rows2,
  Settings,
  Tag,
  WrapText,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { dispatchMenuEvent } from "@/lib/menu-events";
import { checkForUpdates } from "@/lib/updater";
import { useModalStore } from "@/stores/modal-store";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";
import { useUiStore } from "@/stores/ui-store";
import { useCheckout } from "../features/repo/hooks/use-branch-mutations";
import { useRefs } from "../features/repo/hooks/use-refs";
import {
  useFetch,
  usePull,
  usePush,
  useUpstreamStatus,
} from "../features/repo/hooks/use-remote-ops";

export type CommandShortcut = {
  // Tokens are platform-neutral. The renderer is responsible for mapping
  // 'mod' → ⌘ / Ctrl, 'shift' → ⇧ / Shift, etc.
  keys: string[];
};

export type Command = {
  id: string;
  label: string;
  // Used as the heading in both the palette and the shortcuts dialog. Order
  // is determined by the group's first appearance in the array.
  group: string;
  keywords?: string[];
  shortcut?: CommandShortcut;
  // Lucide icon component. Rendered at small size in the palette, omitted
  // from the shortcuts dialog.
  icon?: React.ComponentType<{ className?: string }>;
  // When set, the command is shown disabled in the palette and skipped from
  // shortcut suggestions. Use for "Pull (n behind)" when n=0, etc.
  disabled?: boolean;
  // Show in the shortcuts dialog but not as a runnable palette entry — used
  // for things like "j / k" diff navigation that are bound at a different
  // layer than the palette can invoke.
  shortcutOnly?: boolean;
  run?: () => void;
};

export function useCommands(): Command[] {
  const allBranches = useUiStore((s) => s.commitLogAllBranches);
  const toggleAllBranches = useUiStore((s) => s.toggleCommitLogAllBranches);
  const openSettings = useModalStore((s) => s.openSettings);
  const openShortcuts = useModalStore((s) => s.openShortcuts);
  const wordWrap = useUiStore((s) => s.diffWordWrap);
  const toggleWrap = useUiStore((s) => s.toggleDiffWordWrap);
  const lineNumbers = useUiStore((s) => s.diffLineNumbers);
  const toggleLineNumbers = useUiStore((s) => s.toggleDiffLineNumbers);
  const layout = useUiStore((s) => s.diffLayout);
  const toggleLayout = useUiStore((s) => s.toggleDiffLayout);
  const wordHighlight = useUiStore((s) => s.diffWordHighlight);
  const toggleWordHighlight = useUiStore((s) => s.toggleDiffWordHighlight);

  const { resolvedTheme, setTheme } = useTheme();

  const activeRepo = useRepoStore((s) => s.activeRepo);
  const openRepos = useRepoStore((s) => s.openRepos);
  const welcomeTabOpen = useRepoStore((s) => s.welcomeTabOpen);
  const setActivePath = useRepoStore((s) => s.setActivePath);
  const openWelcomeTab = useRepoStore((s) => s.openWelcomeTab);
  const setViewFn = useSelectionStore((s) => s.setView);

  const path = activeRepo?.path ?? null;
  const setView = useCallback(
    (v: "history" | "changes" | "reflog") => {
      if (path) setViewFn(path, v);
    },
    [path, setViewFn],
  );
  const { data: refs } = useRefs(path);
  const { data: upstream } = useUpstreamStatus(path);

  const checkout = useCheckout(path ?? "");
  const fetchOp = useFetch(path ?? "");
  const pullOp = usePull(path ?? "");
  const pushOp = usePush(path ?? "");

  const branches = refs?.local ?? [];
  const currentBranch = upstream?.branch ?? null;
  const hasUpstream = !!upstream?.upstream;

  return useMemo<Command[]>(() => {
    const out: Command[] = [];

    // Global — always available
    out.push({
      id: "global.shortcuts",
      label: "Keyboard shortcuts",
      group: "Global",
      keywords: ["help", "cheatsheet"],
      shortcut: { keys: ["?"] },
      icon: Keyboard,
      run: openShortcuts,
    });
    out.push({
      id: "global.settings",
      label: "Open settings",
      group: "Global",
      keywords: ["preferences", "config"],
      shortcut: { keys: ["mod", ","] },
      icon: Settings,
      run: openSettings,
    });
    out.push({
      id: "global.checkUpdates",
      label: "Check for updates…",
      group: "Global",
      keywords: ["update", "upgrade", "version", "release"],
      icon: Download,
      run: () => void checkForUpdates({ silent: false }),
    });
    out.push({
      id: "global.toggleTheme",
      label: "Toggle dark / light mode",
      group: "Global",
      keywords: ["theme", "appearance", "dark", "light"],
      shortcut: { keys: ["D"] },
      icon: Moon,
      run: () => {
        const next = resolvedTheme === "dark" ? "light" : "dark";
        setTheme(next);
        toast.success(`${next === "dark" ? "Dark" : "Light"} mode`, { duration: 1200 });
      },
    });
    // ⌘K is registered as a native menu accelerator
    // (src-tauri/src/menu.rs); listed here as `shortcutOnly` without a `run`
    // so it surfaces in the shortcuts dialog without double-firing.
    out.push({
      id: "palette.open",
      label: "Command palette",
      group: "Global",
      keywords: ["palette", "search", "actions"],
      shortcut: { keys: ["mod", "K"] },
      shortcutOnly: true,
    });
    // ⌘R / F5 is bound in src/hooks/use-global-refresh.ts — listed here for
    // discoverability only.
    out.push({
      id: "global.refresh",
      label: "Refresh data",
      group: "Global",
      keywords: ["reload", "invalidate"],
      shortcut: { keys: ["mod", "R"] },
      shortcutOnly: true,
    });

    // Repository
    out.push({
      id: "repo.new",
      label: "New repository…",
      group: "Repository",
      shortcut: { keys: ["mod", "N"] },
      icon: Plus,
      run: () => dispatchMenuEvent("new-repo"),
    });
    out.push({
      id: "repo.open",
      label: "Open repository…",
      group: "Repository",
      shortcut: { keys: ["mod", "O"] },
      icon: GitBranch,
      run: () => dispatchMenuEvent("open-repo"),
    });
    out.push({
      id: "repo.clone",
      label: "Clone repository…",
      group: "Repository",
      shortcut: { keys: ["mod", "shift", "O"] },
      icon: GitBranch,
      run: () => dispatchMenuEvent("clone-repo"),
    });
    out.push({
      id: "tab.new",
      label: "New tab",
      group: "Repository",
      shortcut: { keys: ["mod", "T"] },
      icon: Plus,
      keywords: ["welcome"],
      run: () => dispatchMenuEvent("new-tab"),
    });

    // Tab switching: Cmd+1..8 jump to the Nth tab; Cmd+9 jumps to the last
    // tab (browser convention). Tab order: open repos in array order, then
    // the welcome tab (if open) at the end.
    const switchToTab = (index: number) => {
      const tabs: Array<{ kind: "repo"; path: string } | { kind: "welcome" }> = openRepos.map(
        (r) => ({ kind: "repo" as const, path: r.path }),
      );
      if (welcomeTabOpen) tabs.push({ kind: "welcome" });
      const target = tabs[index];
      if (!target) return;
      if (target.kind === "welcome") void openWelcomeTab();
      else void setActivePath(target.path);
    };
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8] as const) {
      out.push({
        id: `tab.switch${n}`,
        label: `Switch to tab ${n}`,
        group: "Repository",
        shortcut: { keys: ["mod", String(n)] },
        shortcutOnly: true,
        run: () => switchToTab(n - 1),
      });
    }
    out.push({
      id: "tab.switchLast",
      label: "Switch to last tab",
      group: "Repository",
      shortcut: { keys: ["mod", "9"] },
      shortcutOnly: true,
      run: () => switchToTab(openRepos.length + (welcomeTabOpen ? 1 : 0) - 1),
    });
    if (activeRepo) {
      out.push({
        id: "repo.close",
        label: "Close repository",
        group: "Repository",
        shortcut: { keys: ["mod", "W"] },
        icon: LogOut,
        run: () => dispatchMenuEvent("close-repo"),
      });
    }

    // Repo-context-only commands. Without an active repo the palette is hidden
    // entirely (see CommandPalette), so we only emit these conditionally.
    if (activeRepo) {
      out.push({
        id: "view.history",
        label: "Show history",
        group: "View",
        shortcut: { keys: ["H"] },
        icon: History,
        keywords: ["log", "commits"],
        run: () => setView("history"),
      });
      out.push({
        id: "view.changes",
        label: "Show changes",
        group: "View",
        shortcut: { keys: ["C"] },
        icon: Pencil,
        keywords: ["staging", "working tree"],
        run: () => setView("changes"),
      });
      out.push({
        id: "view.allBranches",
        label: allBranches ? "Show current branch only" : "Show all branches",
        group: "View",
        shortcut: { keys: ["A"] },
        icon: GitMerge,
        keywords: ["scope", "log", "filter"],
        run: toggleAllBranches,
      });

      // Remote ops
      out.push({
        id: "remote.fetch",
        label: "Fetch",
        group: "Remote",
        shortcut: { keys: ["mod", "shift", "F"] },
        icon: RefreshCw,
        run: () => fetchOp.mutate({}),
      });
      out.push({
        id: "remote.pull",
        label: hasUpstream && upstream?.behind ? `Pull (${upstream.behind} behind)` : "Pull",
        group: "Remote",
        shortcut: { keys: ["mod", "shift", "L"] },
        icon: ArrowDown,
        disabled: !hasUpstream || (upstream?.behind ?? 0) === 0,
        run: () => pullOp.mutate({}),
      });
      out.push({
        id: "remote.push",
        label: hasUpstream
          ? upstream?.ahead
            ? `Push (${upstream.ahead} ahead)`
            : "Push"
          : "Publish branch",
        group: "Remote",
        shortcut: { keys: ["mod", "shift", "P"] },
        icon: ArrowUp,
        disabled: hasUpstream && (upstream?.ahead ?? 0) === 0,
        run: () => pushOp.mutate(hasUpstream ? {} : { setUpstream: true }),
      });

      // Working tree
      out.push({
        id: "git.newBranch",
        label: "New branch…",
        group: "Git",
        shortcut: { keys: ["mod", "B"] },
        icon: GitBranch,
        run: () => dispatchMenuEvent("new-branch"),
      });
      out.push({
        id: "git.newTag",
        label: "New tag…",
        group: "Git",
        shortcut: { keys: ["mod", "shift", "T"] },
        icon: Tag,
        run: () => dispatchMenuEvent("new-tag"),
      });
      out.push({
        id: "git.stash",
        label: "Stash changes…",
        group: "Git",
        shortcut: { keys: ["S"] },
        icon: Tag,
        keywords: ["save", "wip"],
        run: () => dispatchMenuEvent("create-stash"),
      });

      // Diff viewer prefs — toggling these from the palette is much faster
      // than digging through Settings, especially mid-review.
      out.push({
        id: "diff.layout",
        label: layout === "split" ? "Use unified diff" : "Use split diff",
        group: "Diff viewer",
        icon: layout === "split" ? Rows2 : Columns2,
        keywords: ["side-by-side", "review"],
        run: toggleLayout,
      });
      out.push({
        id: "diff.lineNumbers",
        label: lineNumbers ? "Hide line numbers" : "Show line numbers",
        group: "Diff viewer",
        icon: Hash,
        run: toggleLineNumbers,
      });
      out.push({
        id: "diff.wrap",
        label: wordWrap ? "Disable word wrap" : "Wrap long lines",
        group: "Diff viewer",
        icon: WrapText,
        run: toggleWrap,
      });
      out.push({
        id: "diff.wordHighlight",
        label: wordHighlight ? "Hide word changes" : "Highlight word changes",
        group: "Diff viewer",
        icon: Eye,
        run: toggleWordHighlight,
      });
      out.push({
        id: "diff.nextHunk",
        label: "Next hunk",
        group: "Diff viewer",
        shortcut: { keys: ["J"] },
        shortcutOnly: true,
      });
      out.push({
        id: "diff.prevHunk",
        label: "Previous hunk",
        group: "Diff viewer",
        shortcut: { keys: ["K"] },
        shortcutOnly: true,
      });

      // Commit list nav — bound in src/features/repo/components/commit-list.tsx
      out.push({
        id: "commit.prev",
        label: "Previous commit",
        group: "Commit list",
        shortcut: { keys: ["↑"] },
        shortcutOnly: true,
      });
      out.push({
        id: "commit.next",
        label: "Next commit",
        group: "Commit list",
        shortcut: { keys: ["↓"] },
        shortcutOnly: true,
      });
      out.push({
        id: "commit.first",
        label: "First commit",
        group: "Commit list",
        shortcut: { keys: ["Home"] },
        shortcutOnly: true,
      });
      out.push({
        id: "commit.last",
        label: "Last commit",
        group: "Commit list",
        shortcut: { keys: ["End"] },
        shortcutOnly: true,
      });

      // Changes
      out.push({
        id: "changes.commit",
        label: "Commit",
        group: "Changes",
        shortcut: { keys: ["mod", "↵"] },
        shortcutOnly: true,
      });
      out.push({
        id: "changes.selectAll",
        label: "Select all changed files",
        group: "Changes",
        shortcut: { keys: ["mod", "A"] },
        shortcutOnly: true,
      });
      out.push({
        id: "changes.discardSelected",
        label: "Discard selected files",
        group: "Changes",
        shortcut: { keys: ["mod", "shift", "D"] },
        shortcutOnly: true,
      });

      // Branch switcher — one entry per local branch
      for (const b of branches) {
        out.push({
          id: `branch.checkout.${b.fullName}`,
          label: `Checkout ${b.name}`,
          group: "Switch branch",
          keywords: [b.name, "checkout", "switch", "branch"],
          icon: GitBranch,
          disabled: b.name === currentBranch,
          run: () => checkout.mutate({ target: b.name, create: false }),
        });
      }
    }

    return out;
  }, [
    activeRepo,
    allBranches,
    branches,
    checkout,
    currentBranch,
    fetchOp,
    hasUpstream,
    layout,
    lineNumbers,
    openRepos,
    openSettings,
    openShortcuts,
    openWelcomeTab,
    pullOp,
    pushOp,
    resolvedTheme,
    setActivePath,
    setTheme,
    setView,
    toggleAllBranches,
    toggleLayout,
    toggleLineNumbers,
    toggleWordHighlight,
    toggleWrap,
    upstream?.ahead,
    upstream?.behind,
    welcomeTabOpen,
    wordHighlight,
    wordWrap,
  ]);
}
