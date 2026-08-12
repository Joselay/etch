import { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsFromName } from "@/lib/avatar";
import { cn } from "@/lib/utils";

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
  return (
    <Avatar
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
      title={`${name} <${email}>`}
    >
      <AvatarFallback
        className="bg-muted text-[10px] font-medium text-muted-foreground"
        style={{ fontSize: Math.max(10, Math.round(size * 0.38)) }}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  );
});
