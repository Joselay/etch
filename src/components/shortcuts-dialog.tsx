import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useUiStore } from "@/stores/ui-store";

type Shortcut = {
  keys: string[];
  label: string;
};

type Section = {
  heading: string;
  items: Shortcut[];
};

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");
}

function buildSections(isMac: boolean): Section[] {
  const mod = isMac ? "⌘" : "Ctrl";
  const shift = isMac ? "⇧" : "Shift";
  const alt = isMac ? "⌥" : "Alt";
  void alt;

  return [
    {
      heading: "Global",
      items: [
        { keys: [mod, "K"], label: "Command palette" },
        { keys: [mod, "R"], label: "Refresh" },
        { keys: [mod, ","], label: "Preferences" },
        { keys: [mod, shift, "Y"], label: "Toggle theme" },
        { keys: ["?"], label: "Show keyboard shortcuts" },
      ],
    },
    {
      heading: "Repository",
      items: [
        { keys: [mod, "N"], label: "New repository…" },
        { keys: [mod, "O"], label: "Open repository…" },
        { keys: [mod, shift, "O"], label: "Clone repository…" },
        { keys: [mod, "W"], label: "Close repository" },
      ],
    },
    {
      heading: "View",
      items: [
        { keys: [mod, "1"], label: "History" },
        { keys: [mod, "2"], label: "Changes" },
        { keys: [mod, shift, "B"], label: "Toggle all-branches in log" },
      ],
    },
    {
      heading: "Remote",
      items: [
        { keys: [mod, shift, "F"], label: "Fetch" },
        { keys: [mod, shift, "L"], label: "Pull" },
        { keys: [mod, shift, "P"], label: "Push" },
      ],
    },
    {
      heading: "Git",
      items: [
        { keys: [mod, "B"], label: "New branch…" },
        { keys: [mod, "T"], label: "New tag…" },
        { keys: [mod, "S"], label: "Stash changes…" },
      ],
    },
    {
      heading: "Diff viewer",
      items: [
        { keys: ["J"], label: "Next hunk" },
        { keys: ["K"], label: "Previous hunk" },
      ],
    },
    {
      heading: "Changes",
      items: [{ keys: [mod, "↵"], label: "Commit" }],
    },
  ];
}

export function ShortcutsDialog() {
  const open = useUiStore((s) => s.shortcutsOpen);
  const setOpen = useUiStore((s) => s.setShortcutsOpen);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => setIsMac(detectMac()), []);

  const sections = buildSections(isMac);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Press <Kbd>?</Kbd> any time to open this list.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 max-h-[60vh] overflow-y-auto pr-1">
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
                        <Kbd key={k}>{k}</Kbd>
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
