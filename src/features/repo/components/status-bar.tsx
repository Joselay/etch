// Footer strip that surfaces keyboard shortcuts relevant to the current
// view. It's intentionally tiny — just enough so users can build a mental
// model without opening the cheat sheet every time.

import { Kbd } from "@/components/ui/kbd";
import { formatShortcutKey } from "@/lib/shortcut-format";
import { useSelectionStore } from "@/stores/selection-store";

type Hint = { keys: string[]; label: string };

const COMMON_HINTS: Hint[] = [
  { keys: ["mod", "K"], label: "Commands" },
  { keys: ["?"], label: "Shortcuts" },
];

const HISTORY_HINTS: Hint[] = [
  { keys: ["↑", "↓"], label: "Move" },
  { keys: ["J", "K"], label: "Hunk" },
];

const CHANGES_HINTS: Hint[] = [
  { keys: ["mod", "↵"], label: "Commit" },
  { keys: ["J", "K"], label: "Hunk" },
];

export function StatusBar() {
  const view = useSelectionStore((s) => s.view);
  const viewHints = view === "changes" ? CHANGES_HINTS : HISTORY_HINTS;

  return (
    <footer
      role="contentinfo"
      aria-label="Keyboard shortcut hints"
      className="flex items-center justify-end gap-3 border-t bg-background/80 px-3 py-1 text-[11px] text-muted-foreground"
    >
      {[...viewHints, ...COMMON_HINTS].map((h) => (
        <span key={h.label} className="inline-flex items-center gap-1 whitespace-nowrap">
          <span className="inline-flex items-center gap-0.5">
            {h.keys.map((k) => (
              <Kbd key={k} className="px-1 text-[10px]">
                {formatShortcutKey(k)}
              </Kbd>
            ))}
          </span>
          <span>{h.label}</span>
        </span>
      ))}
    </footer>
  );
}
