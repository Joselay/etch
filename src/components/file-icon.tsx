import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  path: string;
  className?: string;
};

type IconResolver = typeof import("@/lib/file-icon");

let resolverPromise: Promise<IconResolver> | null = null;
const iconUrlCache = new Map<string, string | undefined>();

function loadResolver() {
  resolverPromise ??= import("@/lib/file-icon");
  return resolverPromise;
}

export function FileIcon({ path, className }: Props) {
  const [url, setUrl] = useState<string | undefined>(() => iconUrlCache.get(path));

  useEffect(() => {
    let cancelled = false;
    if (iconUrlCache.has(path)) {
      setUrl(iconUrlCache.get(path));
      return;
    }
    setUrl(undefined);

    // Resolve the large icon manifest after the first paint rather than
    // blocking repository startup. The module import and resolved URLs are
    // shared by every file row.
    const timer = window.setTimeout(() => {
      void loadResolver().then(({ getFileIconUrl }) => {
        const nextUrl = getFileIconUrl(path);
        iconUrlCache.set(path, nextUrl);
        if (!cancelled) setUrl(nextUrl);
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [path]);

  if (!url) return null;
  return <img src={url} alt="" aria-hidden className={cn("h-4 w-4 shrink-0", className)} />;
}
