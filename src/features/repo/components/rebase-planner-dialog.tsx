import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useQuery } from "@tanstack/react-query";
import { GripVertical } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api, type TodoAction, type TodoEntry } from "@/lib/tauri";
import { useStartInteractiveRebase } from "../hooks/use-branch-mutations";

type Props = {
  repoPath: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from: string;
  onto: string;
  title?: string;
};

const ENABLED_ACTIONS: { value: TodoAction; label: string }[] = [
  { value: "pick", label: "pick" },
  { value: "fixup", label: "fixup" },
  { value: "drop", label: "drop" },
];

type Row = TodoEntry & { id: string };

export function RebasePlannerDialog({ repoPath, open, onOpenChange, from, onto, title }: Props) {
  const query = useQuery({
    queryKey: ["rebase-todo", repoPath, from, onto],
    queryFn: () => api.previewRebaseTodo(repoPath, from, onto),
    enabled: open,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const startInteractive = useStartInteractiveRebase(repoPath);

  useEffect(() => {
    if (query.data) {
      setRows(query.data.map((e, i) => ({ ...e, id: `${e.oid}-${i}` })));
    }
  }, [query.data]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setRows((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const updateAction = (id: string, action: TodoAction) => {
    setRows((items) => items.map((r) => (r.id === id ? { ...r, action } : r)));
  };

  const onStart = () => {
    const todo: TodoEntry[] = rows.map(({ action, oid, summary }) => ({ action, oid, summary }));
    startInteractive.mutate(
      { onto, upstream: onto, todo },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  };

  const allDropped = rows.length > 0 && rows.every((r) => r.action === "drop");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title ?? `Rebase onto ${onto}`}</DialogTitle>
          <DialogDescription>
            Reorder commits and pick an action for each. Applied top-to-bottom.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] overflow-y-auto rounded-md border">
          {query.isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : query.error ? (
            <div className="p-4 text-sm text-destructive">Failed to load commits</div>
          ) : rows.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No commits to rebase (range is empty).
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y">
                  {rows.map((row) => (
                    <SortableRow
                      key={row.id}
                      row={row}
                      onActionChange={(a) => updateAction(row.id, a)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onStart}
            disabled={rows.length === 0 || allDropped || startInteractive.isPending}
          >
            {startInteractive.isPending ? "Starting…" : "Start rebase"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SortableRow({
  row,
  onActionChange,
}: {
  row: Row;
  onActionChange: (a: TodoAction) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  const dimmed = row.action === "drop";
  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 bg-background px-2 py-1.5"
    >
      <button
        type="button"
        className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-4" />
      </button>
      <Select value={row.action} onValueChange={(v) => onActionChange(v as TodoAction)}>
        <SelectTrigger className="h-7 w-24 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ENABLED_ACTIONS.map((a) => (
            <SelectItem key={a.value} value={a.value} className="text-xs">
              {a.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <code className="text-xs text-muted-foreground">{row.oid.slice(0, 7)}</code>
      <span
        className={`flex-1 truncate text-sm ${dimmed ? "line-through text-muted-foreground" : ""}`}
        title={row.summary}
      >
        {row.summary}
      </span>
    </li>
  );
}
