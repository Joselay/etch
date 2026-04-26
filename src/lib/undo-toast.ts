import { toast } from "sonner";

export function toastUndoable(
  message: string,
  onUndo: () => void | Promise<void>,
  opts: { duration?: number; undoLabel?: string } = {},
) {
  return toast.success(message, {
    duration: opts.duration ?? 6000,
    action: {
      label: opts.undoLabel ?? "Undo",
      onClick: () => {
        void onUndo();
      },
    },
  });
}
