"use client";

import { ChevronRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { RoleBadge } from "@/components/roles/role-badge";
import { usePresence } from "@/components/presence/presence-provider";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/datetime";
import type { DirectoryMember } from "@/lib/members/summaries";
import { cn } from "@/lib/utils";

import { MemberAvatar } from "./member-avatar";

/**
 * MemberTable — desktop directory table (25/page, server-paginated).
 * Bulk-select checkbox column appears when `canBulk`. Row click opens the
 * member drawer. `onlineOnly` is a client-side presence filter applied to the
 * fetched page (presence lives in the realtime channel, not the DB).
 */
export function MemberTable({
  members,
  selected,
  onToggleSelect,
  onToggleSelectAll,
  onOpenMember,
  canBulk,
  onlineOnly,
}: {
  members: DirectoryMember[];
  selected: Set<string>;
  onToggleSelect: (membershipId: string) => void;
  onToggleSelectAll: () => void;
  onOpenMember: (member: DirectoryMember) => void;
  canBulk: boolean;
  onlineOnly: boolean;
}) {
  const { isOnline } = usePresence();
  const visible = onlineOnly ? members.filter((m) => isOnline(m.userId)) : members;
  const selectable = visible;
  const allSelected = selectable.length > 0 && selectable.every((m) => selected.has(m.membershipId));
  const someSelected = selectable.some((m) => selected.has(m.membershipId));

  return (
    <div className="hidden rounded-lg border md:block">
      <Table>
        <TableHeader>
          <TableRow>
            {canBulk ? (
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = !allSelected && someSelected;
                  }}
                  onChange={onToggleSelectAll}
                  aria-label="Select all members on this page"
                  className="size-4 cursor-pointer accent-primary"
                />
              </TableHead>
            ) : null}
            <TableHead>Member</TableHead>
            <TableHead>Teams</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last active</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Open</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((member) => (
            <TableRow
              key={member.membershipId}
              className={cn("cursor-pointer", !member.isActive && "opacity-70")}
              onClick={() => onOpenMember(member)}
            >
              {canBulk ? (
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.has(member.membershipId)}
                    onChange={() => onToggleSelect(member.membershipId)}
                    aria-label={`Select ${member.fullName}`}
                    className="size-4 cursor-pointer accent-primary"
                  />
                </TableCell>
              ) : null}
              <TableCell>
                <div className="flex items-center gap-3">
                  <MemberAvatar
                    name={member.fullName}
                    avatarUrl={member.avatarUrl}
                    userId={member.userId}
                    showPresence
                  />
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {member.fullName}
                      {!member.isActive ? (
                        <span className="shrink-0 rounded-full border border-warning/40 bg-warning-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-warning">
                          Deactivated
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.title ?? "No title"}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex max-w-48 flex-wrap gap-1">
                  {member.teamNames.length === 0 ? (
                    <span className="text-xs text-muted-foreground">—</span>
                  ) : (
                    member.teamNames.slice(0, 2).map((name) => (
                      <Badge key={name} variant="secondary" className="text-[11px]">
                        {name}
                      </Badge>
                    ))
                  )}
                  {member.teamNames.length > 2 ? (
                    <Badge variant="secondary" className="text-[11px]">
                      +{member.teamNames.length - 2}
                    </Badge>
                  ) : null}
                </div>
              </TableCell>
              <TableCell>
                <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
              </TableCell>
              <TableCell>
                <span className="flex items-center gap-1.5 text-sm">
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      member.isActive ? "bg-success" : "bg-destructive",
                    )}
                    aria-hidden
                  />
                  {member.isActive ? "Active" : "Deactivated"}
                </span>
              </TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-sm text-muted-foreground tabular-nums">
                      {formatRelativeTime(member.lastActiveAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{formatAbsoluteTime(member.lastActiveAt)}</TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {visible.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">
          {onlineOnly ? "Nobody is online right now." : "No members match these filters."}
        </p>
      ) : null}
    </div>
  );
}

/**
 * MemberCards — mobile stacked cards (the same data, no horizontal scroll).
 * Bulk select stays desktop-only per the brief; cards are tap-to-open.
 * On desktop this renders as a 2-col grid when the view toggle selects cards.
 */
export function MemberCards({
  members,
  onOpenMember,
  onlineOnly,
  desktop = false,
}: {
  members: DirectoryMember[];
  onOpenMember: (member: DirectoryMember) => void;
  onlineOnly: boolean;
  desktop?: boolean;
}) {
  const { isOnline } = usePresence();
  const visible = onlineOnly ? members.filter((m) => isOnline(m.userId)) : members;

  return (
    <ul
      className={cn(
        "flex flex-col gap-2",
        desktop && "hidden md:grid md:grid-cols-2 lg:grid-cols-3",
      )}
    >      {visible.map((member) => (
        <li key={member.membershipId}>
          <button
            type="button"
            onClick={() => onOpenMember(member)}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left shadow-sm active:bg-accent",
              !member.isActive && "opacity-70",
            )}
          >
            <MemberAvatar
              name={member.fullName}
              avatarUrl={member.avatarUrl}
              userId={member.userId}
              showPresence
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate font-medium">{member.fullName}</span>
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    member.isActive ? "bg-success" : "bg-destructive",
                  )}
                  aria-hidden
                />
                <span className="sr-only">{member.isActive ? "Active" : "Deactivated"}</span>
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {[member.title, member.teamNames[0]].filter(Boolean).join(" · ") || "No title"}
              </span>
            </span>
            <RoleBadge
              roleName={member.roleName}
              systemKey={member.roleSystemKey}
              className="shrink-0"
            />
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
      {visible.length === 0 ? (
        <li className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {onlineOnly ? "Nobody is online right now." : "No members match these filters."}
        </li>
      ) : null}
    </ul>
  );
}
