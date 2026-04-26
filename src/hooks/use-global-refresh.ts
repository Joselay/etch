import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export function useGlobalRefresh() {
  const qc = useQueryClient();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // Reload: ⌘R / Ctrl+R / F5 — fires even inside inputs so it always works.
      // Not in the command registry because it's a no-context global with its
      // own toast feedback.
      if ((mod && !e.altKey && key === "r") || e.key === "F5") {
        e.preventDefault();
        e.stopPropagation();
        void qc.invalidateQueries();
        toast.success("Refreshed", { duration: 1200 });
      }
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [qc]);
}
