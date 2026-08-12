import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FolderGit2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoTabStrip() {
  const openRepos = useRepoStore((state) => state.openRepos);
  const activeRepo = useRepoStore((state) => state.activeRepo);
  const welcomeTabOpen = useRepoStore((state) => state.welcomeTabOpen);
  const setActivePath = useRepoStore((state) => state.setActivePath);
  const closeRepo = useRepoStore((state) => state.closeRepo);
  const reorderRepos = useRepoStore((state) => state.reorderRepos);
  const openWelcomeTab = useRepoStore((state) => state.openWelcomeTab);
  const closeWelcomeTab = useRepoStore((state) => state.closeWelcomeTab);
  const removeTab = useSelectionStore((state) => state.removeTab);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const closeRepoTab = async (path: string) => {
    removeTab(path);
    await closeRepo(path);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) void reorderRepos(String(active.id), String(over.id));
  };

  return (
    <div
      data-tauri-drag-region
      className={cn(
        "flex h-9 shrink-0 items-stretch gap-px overflow-x-auto border-b bg-muted/30",
        isMac && "pl-[78px]",
      )}
    >
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext
          items={openRepos.map((repo) => repo.path)}
          strategy={horizontalListSortingStrategy}
        >
          {openRepos.map((repo) => (
            <RepoTab
              key={repo.path}
              path={repo.path}
              active={repo.path === activeRepo?.path}
              onActivate={() => void setActivePath(repo.path)}
              onClose={() => void closeRepoTab(repo.path)}
            />
          ))}
        </SortableContext>
      </DndContext>
      {welcomeTabOpen && (
        <div
          className={cn(
            "group/tab flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
            activeRepo === null ? "bg-background" : "hover:bg-background/60",
          )}
        >
          <button
            type="button"
            onClick={() => void openWelcomeTab()}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
          >
            <Plus className="h-3 w-3 text-muted-foreground" />
            <span>Open repository</span>
          </button>
          <button
            type="button"
            onClick={() => void closeWelcomeTab()}
            className="flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Close open repository tab"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

function RepoTab({
  path,
  active,
  onActivate,
  onClose,
}: {
  path: string;
  active: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const folder = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const sortable = useSortable({ id: path });
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn(
        "group/tab flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
        active ? "bg-background" : "hover:bg-background/60",
        sortable.isDragging && "z-10 opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex min-w-0 flex-1 cursor-grab items-center gap-1.5 py-1.5 active:cursor-grabbing"
        title={path}
        {...sortable.attributes}
        {...sortable.listeners}
      >
        <FolderGit2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{folder}</span>
      </button>
      <button
        type="button"
        aria-label={`Close ${folder}`}
        onClick={onClose}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
