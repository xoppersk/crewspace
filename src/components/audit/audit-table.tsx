"use client";

import { useMemo } from "react";
import { ScrollText } from "lucide-react";

import { formatAbsoluteTime } from "@/lib/audit/relative-time";
import { formatAuditEvent } from "@/lib/audit/sentences";
import type { ActorInfo, AuditEvent } from "@/lib/audit/types";
import { EmptyState } from "@/components/app/empty-state";

/**
 * Audit chronicle — the day-grouped sentence list (Flagship UI Designs
 * artifact, Crewspace): sticky date dividers ("Tuesday · October 6, 2026"),
 * plain-language sentences with the actor in bold, and a mono
 * "3:18 PM · Role assignment" line under each. Clicking a sentence opens
 * the detail drawer. One rendering for desktop and mobile.
 */

/** Per-action category labels for the "time · category" line. */
const EVENT_LABELS: Record<string, string> = {
  "membership.created": "Member joined",
  "membership.role_changed": "Role assignment",
  "membership.deactivated": "Access revoked",
  "membership.reactivated": "Access restored",
  "membership.removed": "Member removed",
  "invitation.sent": "Invitation sent",
  "invitation.bulk_sent": "Invitations sent",
  "invitation.resent": "Invitation resent",
  "invitation.revoked": "Invitation revoked",
  "invitation.accepted": "Invitation accepted",
  "role.created": "Role created",
  "role.permissions_changed": "Permission policy",
  "role.deleted": "Role deleted",
  "team.created": "Team created",
  "team.member_added": "Team change",
  "audit.exported": "Audit exported",
  "org.created": "Organization created",
  "org.ownership_transferred": "Ownership transferred",
  "settings.updated": "Settings updated",
};

function eventLabel(action: string): string {
  return (
    EVENT_LABELS[action] ??
    action
      .split(".")
      .map((part) => part.replace(/_/g, " "))
      .join(" · ")
  );
}

/** "Tuesday · October 6, 2026" — the artifact's date divider. */
function formatDayDivider(iso: string): string {
  const date = new Date(iso);
  const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
  const day = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return `${weekday} · ${day}`;
}

/** "3:18 PM" — the artifact's sentence timestamp. */
function formatSentenceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

interface DayGroup {
  key: string;
  label: string;
  items: AuditEvent[];
}

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
  const days = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, DayGroup>();
    for (const event of events) {
      const key = new Date(event.created_at).toDateString();
      let group = groups.get(key);
      if (!group) {
        group = { key, label: formatDayDivider(event.created_at), items: [] };
        groups.set(key, group);
      }
      group.items.push(event);
    }
    return [...groups.values()];
  }, [events]);

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
    <div>
      {days.map((day) => (
        <section key={day.key} aria-label={day.label}>
          <div className="date-divider">{day.label}</div>
          {day.items.map((event) => {
            const actor = actors.get(event.actor_id) ?? null;
            const actorName = actor?.full_name?.trim() || "Someone";
            const sentence = formatAuditEvent(actor?.full_name ?? null, event);
            const rest = sentence.startsWith(actorName)
              ? sentence.slice(actorName.length)
              : ` ${sentence}`;
            return (
              <button
                key={event.id}
                type="button"
                className="audit-sentence"
                onClick={() => onSelect(event)}
                title={formatAbsoluteTime(event.created_at)}
              >
                <span>
                  <b className="font-semibold">{actorName}</b>
                  {rest}
                </span>
                <time>
                  {formatSentenceTime(event.created_at)} · {eventLabel(event.action)}
                </time>
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}
