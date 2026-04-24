import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { gravatarHash, gravatarUrl, initialsFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";

type Props = {
  name: string;
  email: string;
  size?: number;
  className?: string;
};

export function AuthorAvatar({ name, email, size = 24, className }: Props) {
  const [hash, setHash] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    gravatarHash(email).then((h) => {
      if (!cancelled) setHash(h);
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  return (
    <Avatar className={cn("shrink-0", className)} style={{ width: size, height: size }}>
      {hash && <AvatarImage src={gravatarUrl(hash, size * 2)} alt={name} loading="lazy" />}
      <AvatarFallback
        className="text-[10px] font-medium"
        style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
}
