"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/presence/presence-dot";
import { cn } from "@/lib/utils";

/** Initials fallback for avatars. */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * MemberAvatar — avatar with an optional realtime presence dot overlaid at
 * the bottom-right. Used across directory, teams, and dashboard.
 */
export function MemberAvatar({
  name,
  avatarUrl,
  userId,
  size = "default",
  showPresence = false,
  className,
}: {
  name: string;
  avatarUrl: string | null;
  userId: string;
  size?: "default" | "sm" | "lg";
  showPresence?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex shrink-0", className)}>
      <Avatar size={size}>
        {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      {showPresence ? (
        <PresenceDot userId={userId} className="absolute -right-0.5 -bottom-0.5" />
      ) : null}
    </span>
  );
}
