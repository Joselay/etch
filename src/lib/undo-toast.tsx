import { CircleCheckIcon } from "lucide-react";
import { toast } from "sonner";

export function toastUndoable(
  message: string,
  onUndo: () => void | Promise<void>,
  opts: { duration?: number; undoLabel?: string } = {},
) {
  const duration = opts.duration ?? 6000;
  const undoLabel = opts.undoLabel ?? "Undo";

  return toast.custom(
    (id) => (
      <div
        className="group/undo relative flex w-[356px] items-center gap-2.5 overflow-hidden border border-border bg-popover px-4 py-3 text-[13px] text-popover-foreground shadow-lg"
        style={{ borderRadius: "var(--radius)" }}
      >
        <CircleCheckIcon className="size-4 shrink-0" />
        <span className="flex-1 truncate">{message}</span>
        <button
          type="button"
          onClick={() => {
            toast.dismiss(id);
            void onUndo();
          }}
          className="-mr-1 rounded px-2 py-1 text-xs font-medium text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {undoLabel}
        </button>
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 block h-[2px] w-full bg-foreground/50 group-hover/undo:[animation-play-state:paused]"
          style={{ animation: `undo-toast-progress ${duration}ms linear forwards` }}
        />
      </div>
    ),
    { duration },
  );
}
