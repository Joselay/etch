import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable;
}

export function useThemeShortcut() {
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod || !e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== "l") return;
      if (isTypingTarget(e.target)) return;

      e.preventDefault();
      e.stopPropagation();
      const next = resolvedTheme === "dark" ? "light" : "dark";
      setTheme(next);
      toast.success(`${next === "dark" ? "Dark" : "Light"} mode`, { duration: 1200 });
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [resolvedTheme, setTheme]);
}
