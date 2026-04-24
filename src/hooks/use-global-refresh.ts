import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

export function useGlobalRefresh() {
  const qc = useQueryClient();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const isReload = mod && !e.altKey && e.key.toLowerCase() === "r";
      const isF5 = e.key === "F5";
      if (!isReload && !isF5) return;
      e.preventDefault();
      e.stopPropagation();
      void qc.invalidateQueries();
      toast.success("Refreshed", { duration: 1200 });
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, [qc]);
}
