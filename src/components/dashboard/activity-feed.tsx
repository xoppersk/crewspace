"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/datetime";

export interface ActivityEvent {
  id: string;
  action: string;
  actorName: string;
  targetLabel: string | null;
  createdAt: string;
}

const ACTION_SENTENCES: Record<string, (actor: string, target: string | null) => string> = {
  "org.created": (a) => `${a} created the organization`,
  "membership.created": (_a, t) => `${t ?? "Someone"} joined the organization`,
  "membership.role_changed": (a, t) => `${a} changed ${t ?? "a member"}'s role`,
  "membership.deactivated": (a, t) => `${a} deactivated ${t ?? "a member"}`,
  "membership.reactivated": (a, t) => `${a} reactivated ${t ?? "a member"}`,
  "membership.removed": (a, t) => `${a} removed ${t ?? "a member"}`,
  "invitation.sent": (a, t) => `${a} invited ${t ?? "someone"}`,
  "invitation.accepted": (_a, t) => `${t ?? "Someone"} accepted their invitation`,
  "invitation.resent": (a, t) => `${a} resent an invitation to ${t ?? "someone"}`,
  "invitation.revoked": (a, t) => `${a} revoked an invitation to ${t ?? "someone"}`,
  "team.created": (a, t) => `${a} created the ${t ?? "a"} team`,
  "team.updated": (a, t) => `${a} updated the ${t ?? "a"} team`,
  "team.archived": (a, t) => `${a} archived the ${t ?? "a"} team`,
  "team.unarchived": (a, t) => `${a} unarchived the ${t ?? "a"} team`,
  "team.lead_changed": (a, t) => `${a} changed the lead of ${t ?? "a team"}`,
  "team.member_added": (a, t) => `${a} added a member to ${t ?? "a team"}`,
  "team.member_removed": (a, t) => `${a} removed a member from ${t ?? "a team"}`,
  "role.permissions_changed": (a, t) => `${a} changed permissions for ${t ?? "a role"}`,
  "role.created": (a, t) => `${a} created the ${t ?? "a"} role`,
  "settings.updated": (a) => `${a} updated organization settings`,
  "audit.exported": (a) => `${a} exported the audit log`,
};

function sentence(event: ActivityEvent): string {
  const fn = ACTION_SENTENCES[event.action];
  return fn ? fn(event.actorName, event.targetLabel) : `${event.actorName} — ${event.action}`;
}

/**
 * ActivityFeed — latest 8 audit events, live via a Postgres Changes
 * subscription on `audit_log` (INSERT, scoped to the org). Actor names for
 * live events resolve with a profile lookup; unknown actors fall back to
 * "Someone". Only rendered when the viewer holds `audit:read`.
 */
export function ActivityFeed({
  orgId,
  initialEvents,
}: {
  orgId: string;
  initialEvents: ActivityEvent[];
}) {
  const [events, setEvents] = useState<ActivityEvent[]>(initialEvents);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`audit:org:${orgId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
          filter: `org_id=eq.${orgId}`,
        },
        async (payload) => {
          const row = payload.new as {
            id: string;
            action: string;
            actor_id: string;
            target_label: string | null;
            created_at: string;
          };
          let actorName = "Someone";
          try {
            const { data } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", row.actor_id)
              .maybeSingle();
            if (data?.full_name) actorName = data.full_name;
          } catch {
            // fall back to "Someone"
          }
          setEvents((prev) =>
            [
              {
                id: row.id,
                action: row.action,
                actorName,
                targetLabel: row.target_label,
                createdAt: row.created_at,
              },
              ...prev,
            ].slice(0, 8),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          Recent activity
          <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            live
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No activity yet — changes will appear here in realtime.
          </p>
        ) : (
          <ul className="flex flex-col">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex items-baseline justify-between gap-3 border-t py-2.5 text-sm first:border-t-0"
              >
                <span className="min-w-0">{sentence(event)}</span>
                <span
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  title={formatAbsoluteTime(event.createdAt)}
                >
                  {formatRelativeTime(event.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
