import { getFileIconUrl } from "@/lib/file-icon";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  className?: string;
};

export function FileIcon({ path, className }: Props) {
  const url = getFileIconUrl(path);
  if (!url) return null;
  return <img src={url} alt="" aria-hidden className={cn("h-4 w-4 shrink-0", className)} />;
}
