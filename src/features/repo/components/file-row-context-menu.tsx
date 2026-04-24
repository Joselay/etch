import { join } from "@tauri-apps/api/path";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { Copy, FolderOpen } from "lucide-react";
import { toast } from "sonner";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { errorMessage } from "@/lib/tauri";

const isMac = typeof navigator !== "undefined" && /mac|iphone|ipad|ipod/i.test(navigator.platform);
const revealLabel = isMac ? "Reveal in Finder" : "Show in Explorer";

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`, { duration: 1200 });
  } catch (err) {
    toast.error(`Couldn't copy: ${errorMessage(err)}`);
  }
}

export function FileRowContextMenu({
  repoPath,
  relPath,
  children,
}: {
  repoPath: string;
  relPath: string;
  children: React.ReactNode;
}) {
  const resolveAbs = () => join(repoPath, relPath);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onSelect={async () => {
            try {
              await revealItemInDir(await resolveAbs());
            } catch (err) {
              toast.error(`Couldn't reveal: ${errorMessage(err)}`);
            }
          }}
        >
          <FolderOpen />
          {revealLabel}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={async () => copyText(await resolveAbs(), "Absolute path")}>
          <Copy />
          Copy path
        </ContextMenuItem>
        <ContextMenuItem onSelect={() => copyText(relPath, "Relative path")}>
          <Copy />
          Copy relative path
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
