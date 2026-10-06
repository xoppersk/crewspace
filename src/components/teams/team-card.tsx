"use client";

import Link from "next/link";
import { Archive } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar } from "@/components/directory/member-avatar";
import { cn } from "@/lib/utils";

export interface TeamCardData {
  id: string;
  name: string;
  description: string | null;
  isArchived: boolean;
  memberCount: number;
  lead: { userId: string; fullName: string; avatarUrl: string | null } | null;
  previewMembers: { userId: string; fullName: string; avatarUrl: string | null }[];
}

/**
 * TeamCard — name, description, lead avatar, member avatar stack (first 5 +
 * "+n"), archived badge. Links to the team detail page.
 */
export function TeamCard({ orgSlug, team }: { orgSlug: string; team: TeamCardData }) {
  return (
    <Link
      href={`/${orgSlug}/teams/${team.id}`}
      className="block rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
      aria-label={`${team.name} team${team.isArchived ? " (archived)" : ""}`}
    >
      <Card
        className={cn(
          "h-full transition-shadow hover:shadow-md",
          team.isArchived && "opacity-75",
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base leading-snug">{team.name}</CardTitle>
            {team.isArchived ? (
              <Badge variant="outline" className="gap-1 shrink-0">
                <Archive className="size-3" aria-hidden /> Archived
              </Badge>
            ) : null}
          </div>
          {team.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{team.description}</p>
          ) : null}
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div className="flex -space-x-2" aria-label={`${team.memberCount} members`}>
            {team.previewMembers.slice(0, 5).map((m) => (
              <MemberAvatar
                key={m.userId}
                name={m.fullName}
                avatarUrl={m.avatarUrl}
                userId={m.userId}
                size="sm"
                className="ring-2 ring-card"
              />
            ))}
            {team.memberCount > 5 ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                +{team.memberCount - 5}
              </span>
            ) : null}
            {team.memberCount === 0 ? (
              <span className="text-xs text-muted-foreground">No members yet</span>
            ) : null}
          </div>
          {team.lead ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <MemberAvatar
                name={team.lead.fullName}
                avatarUrl={team.lead.avatarUrl}
                userId={team.lead.userId}
                size="sm"
              />
              <span className="max-w-24 truncate text-xs text-muted-foreground">
                {team.lead.fullName}
              </span>
              <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Lead
              </span>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}
