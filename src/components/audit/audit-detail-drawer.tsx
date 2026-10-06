"use client";

import { Fingerprint, Globe, Tag } from "lucide-react";

import { useIsMobile } from "@/hooks/use-media-query";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/audit/relative-time";
import { formatAuditEvent } from "@/lib/audit/sentences";
import type { ActorInfo, AuditEvent } from "@/lib/audit/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

function initials(name: string | null | undefined): string {
  const parts = (name ?? "?").trim().split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

function humanizeKey(key: string): string {
  const clean = key.replace(/_id$/, "").replace(/_/g, " ");
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(stringify).join(", ") || "—";
  return JSON.stringify(value);
}

/**
 * Renders a before/after diff as readable key changes:
 *   { role: { from: "Member", to: "Manager" } } → "Role: Member → Manager"
 * Falls back to plain key/value rows for scalar or array values.
 */
export function AuditDiff({ diff }: { diff: Record<string, unknown> }) {
  const entries = Object.entries(diff);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No recorded changes.</p>;
  }
  return (
    <dl className="flex flex-col divide-y rounded-lg border">
      {entries.map(([key, value]) => {
        const pair =
          value !== null && typeof value === "object" && !Array.isArray(value)
            ? (value as { from?: unknown; to?: unknown })
            : null;
        const isPair = pair !== null && ("from" in pair || "to" in pair);
        return (
          <div key={key} className="flex items-start justify-between gap-4 px-3 py-2.5 text-sm">
            <dt className="shrink-0 font-medium text-muted-foreground">{humanizeKey(key)}</dt>
            <dd className="text-right">
              {isPair ? (
                <span className="flex flex-wrap items-center justify-end gap-1.5">
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {stringify(pair.from)}
                  </span>
                  <span aria-hidden="true" className="text-muted-foreground">
                    →
                  </span>
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {stringify(pair.to)}
                  </span>
                </span>
              ) : (
                <span className="font-mono text-xs">{stringify(value)}</span>
              )}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/**
 * Row → detail drawer: full before/after diff, IP + user agent, request id.
 * Slide-over on desktop, bottom sheet on mobile.
 */
export function AuditDetailDrawer({
  event,
  actor,
  open,
  onOpenChange,
}: {
  event: AuditEvent | null;
  actor: ActorInfo | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={
          isMobile
            ? "max-h-[85svh] rounded-t-2xl"
            : "w-full sm:max-w-md"
        }
      >
        {event ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>Event detail</SheetTitle>
              <SheetDescription>{formatAuditEvent(actor?.full_name ?? null, event)}</SheetDescription>
            </SheetHeader>
            <ScrollArea className="min-h-0 flex-1">
              <div className="flex flex-col gap-5 pr-1 pb-6">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    {actor?.avatar_url ? <AvatarImage src={actor.avatar_url} alt="" /> : null}
                    <AvatarFallback>{initials(actor?.full_name)}</AvatarFallback>
                  </Avatar>
                  <div className="text-sm">
                    <p className="font-medium">{actor?.full_name ?? "Unknown actor"}</p>
                    <p className="text-muted-foreground" title={event.created_at}>
                      {formatRelativeTime(event.created_at)} · {formatAbsoluteTime(event.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <Badge variant="outline" className="font-mono">
                    <Tag className="mr-1 size-3" />
                    {event.action}
                  </Badge>
                  {event.target_label ? (
                    <Badge variant="secondary">Target: {event.target_label}</Badge>
                  ) : null}
                </div>

                <section aria-label="Changes">
                  <h3 className="mb-2 text-sm font-semibold">Changes</h3>
                  <AuditDiff diff={event.diff} />
                </section>

                <section aria-label="Request details">
                  <h3 className="mb-2 text-sm font-semibold">Request</h3>
                  <dl className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <Globe className="size-3.5" /> IP address
                      </dt>
                      <dd className="font-mono text-xs">
                        {typeof event.metadata.ip === "string" && event.metadata.ip
                          ? event.metadata.ip
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="flex items-center gap-1.5 font-medium text-muted-foreground">
                        <Fingerprint className="size-3.5" /> Request ID
                      </dt>
                      <dd className="font-mono text-xs">
                        {typeof event.metadata.request_id === "string" && event.metadata.request_id
                          ? event.metadata.request_id
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="font-medium text-muted-foreground">User agent</dt>
                      <dd className="font-mono text-xs break-all text-muted-foreground">
                        {typeof event.metadata.user_agent === "string" && event.metadata.user_agent
                          ? event.metadata.user_agent
                          : "—"}
                      </dd>
                    </div>
                  </dl>
                </section>
              </div>
            </ScrollArea>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
