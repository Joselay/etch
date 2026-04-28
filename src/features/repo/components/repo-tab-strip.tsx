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
import { GitBranch, X } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import { cn } from "@/lib/utils";
import { useRepoStore } from "@/stores/repo-store";
import { useSelectionStore } from "@/stores/selection-store";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

export function RepoTabStrip() {
  const openRepos = useRepoStore((s) => s.openRepos);
  const activeRepo = useRepoStore((s) => s.activeRepo);
  const welcomeTabOpen = useRepoStore((s) => s.welcomeTabOpen);
  const remoteUrls = useRepoStore((s) => s.remoteUrls);
  const setActivePath = useRepoStore((s) => s.setActivePath);
  const closeRepo = useRepoStore((s) => s.closeRepo);
  const reorderRepos = useRepoStore((s) => s.reorderRepos);
  const openWelcomeTab = useRepoStore((s) => s.openWelcomeTab);
  const closeWelcomeTab = useRepoStore((s) => s.closeWelcomeTab);
  const removeTab = useSelectionStore((s) => s.removeTab);

  const closeRepoTab = async (path: string) => {
    removeTab(path);
    await closeRepo(path);
  };

  const welcomeIsActive = welcomeTabOpen && activeRepo === null;

  // Tabs are easy to click; use a small distance threshold so a click never
  // turns into a drag, but a deliberate horizontal pull does.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    void reorderRepos(String(active.id), String(over.id));
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
          items={openRepos.map((r) => r.path)}
          strategy={horizontalListSortingStrategy}
        >
          {openRepos.map((r) => {
            const remoteUrl = remoteUrls[r.path] ?? null;
            return (
              <RepoTab
                key={r.path}
                path={r.path}
                remoteUrl={remoteUrl}
                isActive={r.path === activeRepo?.path}
                onActivate={() => setActivePath(r.path)}
                onClose={() => void closeRepoTab(r.path)}
              />
            );
          })}
        </SortableContext>
      </DndContext>
      {welcomeTabOpen && (
        <div
          className={cn(
            "group/tab relative flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
            welcomeIsActive ? "bg-background" : "hover:bg-background/60",
          )}
        >
          <button
            type="button"
            onClick={() => void openWelcomeTab()}
            className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
            title="Welcome"
          >
            <GitBranch className="h-3 w-3 shrink-0 text-muted-foreground" />
            <span className="truncate">New Tab</span>
          </button>
          <button
            type="button"
            aria-label="Close New Tab"
            onClick={() => void closeWelcomeTab()}
            className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100 data-[active=true]:opacity-100"
            data-active={welcomeIsActive}
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
  remoteUrl,
  isActive,
  onActivate,
  onClose,
}: {
  path: string;
  remoteUrl: string | null;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const folder = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: path,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/tab relative flex min-w-0 max-w-[220px] items-center gap-1.5 border-r px-2 text-xs",
        isActive ? "bg-background" : "hover:bg-background/60",
        isDragging && "z-10 opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onActivate}
        className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 cursor-grab active:cursor-grabbing"
        title={path}
        {...attributes}
        {...listeners}
      >
        <ProviderIcon url={remoteUrl} className="h-3 w-3" />
        <span className="truncate">{folder}</span>
      </button>
      <button
        type="button"
        aria-label={`Close ${folder}`}
        onClick={onClose}
        className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover/tab:opacity-100 data-[active=true]:opacity-100"
        data-active={isActive}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
