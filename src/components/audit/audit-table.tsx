"use client";

import { ScrollText } from "lucide-react";

import { formatAbsoluteTime, formatRelativeTime } from "@/lib/audit/relative-time";
import { formatAuditEvent } from "@/lib/audit/sentences";
import type { ActorInfo, AuditEvent } from "@/lib/audit/types";
import { EmptyState } from "@/components/app/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function initials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function ActorCell({ actor }: { actor: ActorInfo | null }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar className="size-7">
        {actor?.avatar_url ? <AvatarImage src={actor.avatar_url} alt="" /> : null}
        <AvatarFallback className="text-[10px]">{initials(actor?.full_name)}</AvatarFallback>
      </Avatar>
      <span className="truncate font-medium">{actor?.full_name ?? "Unknown actor"}</span>
    </span>
  );
}

/**
 * Audit event table: relative timestamp (absolute on hover), actor avatar +
 * name, human-readable sentence, target, IP. Dense rows on desktop; stacked
 * cards on mobile (never a horizontally scrolling table on a phone).
 */
export function AuditTable({
  events,
  actors,
  onSelect,
  hasFilters,
  onClearFilters,
}: {
  events: AuditEvent[];
  actors: Map<string, ActorInfo>;
  onSelect: (event: AuditEvent) => void;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title={hasFilters ? "No events match these filters" : "No events yet"}
        description={
          hasFilters
            ? "Try widening the date range or clearing a filter."
            : "Actions taken in this organization will appear here."
        }
        action={
          hasFilters ? (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-sm font-medium text-primary hover:underline"
            >
              Clear filters
            </button>
          ) : undefined
        }
      />
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Time</TableHead>
              <TableHead className="w-44">Actor</TableHead>
              <TableHead>Event</TableHead>
              <TableHead className="w-40">IP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((event) => {
              const actor = actors.get(event.actor_id) ?? null;
              return (
                <TableRow
                  key={event.id}
                  className="cursor-pointer"
                  onClick={() => onSelect(event)}
                >
                  <TableCell
                    className="whitespace-nowrap text-muted-foreground tabular-nums"
                    title={formatAbsoluteTime(event.created_at)}
                  >
                    {formatRelativeTime(event.created_at)}
                  </TableCell>
                  <TableCell>
                    <ActorCell actor={actor} />
                  </TableCell>
                  <TableCell className="max-w-md">
                    <span className="block truncate" title={formatAuditEvent(actor?.full_name ?? null, event)}>
                      {formatAuditEvent(actor?.full_name ?? null, event)}
                    </span>
                    {event.target_label ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {event.target_label}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {typeof event.metadata.ip === "string" ? event.metadata.ip : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-2 md:hidden">
        {events.map((event) => {
          const actor = actors.get(event.actor_id) ?? null;
          return (
            <button
              key={event.id}
              type="button"
              onClick={() => onSelect(event)}
              className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <ActorCell actor={actor} />
                <span
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  title={formatAbsoluteTime(event.created_at)}
                >
                  {formatRelativeTime(event.created_at)}
                </span>
              </div>
              <p className="text-sm">{formatAuditEvent(actor?.full_name ?? null, event)}</p>
            </button>
          );
        })}
      </div>
    </>
  );
}
