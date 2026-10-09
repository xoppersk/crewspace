"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { PresenceDot } from "@/components/presence/presence-dot";
import { Identicon } from "@/components/crew/identicon";
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
 * the bottom-right. Members without an uploaded photo get a seeded geometric
 * identicon (UI-DESIGN.md §6); initials are the last-resort fallback.
 * Used across directory, teams, and dashboard.
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
        {avatarUrl ? (
          <AvatarImage src={avatarUrl} alt={name} />
        ) : (
          <Identicon seed={userId} title={name} className="size-full" />
        )}
      </Avatar>
      {showPresence ? (
        <PresenceDot userId={userId} className="absolute -right-0.5 -bottom-0.5" />
      ) : null}
    </span>
  );
}
