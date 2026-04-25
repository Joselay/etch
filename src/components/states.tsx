// Tiny wrappers around the shadcn `Empty` primitive that turn the
// "loading…" / "{error.message}" / "no data" patterns scattered across the
// app into something with consistent spacing, iconography, and a clear next
// action. Use these instead of free-form `<div className="p-4 text-xs">`.

import { AlertCircle } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

type Tone = "default" | "compact";

const toneClass: Record<Tone, string> = {
  default: "py-8",
  compact: "py-4",
};

export function LoadingState({
  label = "Loading…",
  tone = "default",
  className,
}: {
  label?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <Empty className={cn(toneClass[tone], className)}>
      <EmptyHeader>
        <EmptyMedia>
          <Spinner />
        </EmptyMedia>
        <EmptyDescription>{label}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

export function ErrorState({
  error,
  onRetry,
  retryLabel = "Try again",
  title = "Couldn't load",
  tone = "default",
  className,
  extra,
}: {
  error: Error | string;
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
  tone?: Tone;
  className?: string;
  extra?: React.ReactNode;
}) {
  const message = typeof error === "string" ? error : error.message;
  return (
    <Empty className={cn(toneClass[tone], className)}>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <AlertCircle className="text-destructive" />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription className="break-words font-mono text-[11px]">{message}</EmptyDescription>
      </EmptyHeader>
      {(onRetry || extra) && (
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {onRetry && (
              <Button size="sm" variant="outline" onClick={onRetry}>
                {retryLabel}
              </Button>
            )}
            {extra}
          </div>
        </EmptyContent>
      )}
    </Empty>
  );
}
