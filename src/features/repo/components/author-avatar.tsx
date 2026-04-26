import { memo, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { githubNoreplyAvatar, gravatarHash, gravatarUrl, initialsFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { useRemoteAuthorsContext } from "../remote-authors-context";

type Props = {
  name: string;
  email: string;
  size?: number;
  className?: string;
};

export const AuthorAvatar = memo(function AuthorAvatar({
  name,
  email,
  size = 24,
  className,
}: Props) {
  const pixels = size * 2;
  const { map, isSettled } = useRemoteAuthorsContext();
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const remoteUrl = map.get(normalizedEmail) ?? null;
  // GitHub no-reply emails are deterministic — safe to show immediately even
  // before the remote-authors query settles.
  const githubUrl = useMemo(
    () => (remoteUrl ? null : githubNoreplyAvatar(normalizedEmail, pixels)),
    [remoteUrl, normalizedEmail, pixels],
  );
  // Gravatar identicons would otherwise flicker into real avatars once the
  // remote-authors query resolves. Only fall back to them after settle.
  const canUseGravatar = !remoteUrl && !githubUrl && isSettled;
  const [gravatarSrc, setGravatarSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!canUseGravatar) {
      setGravatarSrc(null);
      return;
    }
    let cancelled = false;
    gravatarHash(email).then((h) => {
      if (!cancelled) setGravatarSrc(gravatarUrl(h, pixels));
    });
    return () => {
      cancelled = true;
    };
  }, [email, canUseGravatar, pixels]);

  const src = remoteUrl ?? githubUrl ?? gravatarSrc;
  // While the remote-authors query is in flight and we have no image yet, show a
  // Skeleton instead of initials so the "loading" state is legible.
  if (!src && !isSettled) {
    return (
      <Skeleton
        className={cn("shrink-0 rounded-full", className)}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <Avatar className={cn("shrink-0", className)} style={{ width: size, height: size }}>
      {src && <AvatarImage src={src} alt={name} loading="lazy" />}
      <AvatarFallback
        className="text-[10px] font-medium"
        style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
});
