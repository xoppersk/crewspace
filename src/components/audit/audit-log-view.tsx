"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ChevronLeft, ChevronRight, Loader2, Pause, Play } from "lucide-react";

import {
  describeFilters,
  filtersToSearchParams,
  hasActiveFilters,
} from "@/lib/audit/filters";
import { AUDIT_PAGE_SIZE, type ActorInfo, type AuditEvent, type AuditFilters } from "@/lib/audit/types";
import { AUDIT_RETENTION_LABEL } from "@/lib/plan";
import { exportAuditCsv } from "@/app/(app)/[orgSlug]/audit/actions";
import { AuditDetailDrawer } from "./audit-detail-drawer";
import { AuditFilterBar } from "./audit-filter-bar";
import { AuditTable } from "./audit-table";
import { useAuditLiveTail } from "./use-audit-live-tail";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

function LiveTailToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="audit-live"
        checked={enabled}
        onCheckedChange={onChange}
        aria-label="Live tail: stream new events as they happen"
      />
      <Label htmlFor="audit-live" className="flex items-center gap-1.5 text-sm font-medium">
        {enabled ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
        Live
        {enabled ? (
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
        ) : null}
      </Label>
    </div>
  );
}

function ExportButton({
  canExport,
  onExport,
  state,
}: {
  canExport: boolean;
  onExport: () => void;
  state: { status: "idle" | "exporting" | "done" | "error"; message?: string; rows?: number };
}) {
  if (!canExport) return null;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={onExport} disabled={state.status === "exporting"}>
        {state.status === "exporting" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <ArrowDownToLine className="size-4" />
        )}
        {state.status === "exporting" ? "Exporting…" : "Export CSV"}
      </Button>
      {state.status === "done" ? (
        <p className="text-xs text-muted-foreground">
          Exported {state.rows} row{state.rows === 1 ? "" : "s"} — the export was logged.
        </p>
      ) : null}
      {state.status === "error" ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Client orchestrator for the audit log page. The server owns the filtered
 * query (filters live in the URL); this component owns the live tail,
 * the detail drawer, pagination, and the CSV export download.
 */
export function AuditLogView({
  orgSlug,
  orgId,
  initialEvents,
  initialTotal,
  initialFilters,
  actors,
  actorOptions,
  canExport,
}: {
  orgSlug: string;
  orgId: string;
  initialEvents: AuditEvent[];
  initialTotal: number;
  initialFilters: AuditFilters;
  actors: ActorInfo[];
  actorOptions: ActorInfo[];
  canExport: boolean;
}) {
  // Reset live state whenever the server-provided filter view changes.
  const signature = JSON.stringify(initialFilters);
  return (
    <AuditLogViewInner
      key={signature}
      orgSlug={orgSlug}
      orgId={orgId}
      initialEvents={initialEvents}
      initialTotal={initialTotal}
      initialFilters={initialFilters}
      actors={actors}
      actorOptions={actorOptions}
      canExport={canExport}
    />
  );
}

function AuditLogViewInner({
  orgSlug,
  orgId,
  initialEvents,
  initialTotal,
  initialFilters,
  actors,
  actorOptions,
  canExport,
}: {
  orgSlug: string;
  orgId: string;
  initialEvents: AuditEvent[];
  initialTotal: number;
  initialFilters: AuditFilters;
  actors: ActorInfo[];
  actorOptions: ActorInfo[];
  canExport: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [scrolledDown, setScrolledDown] = useState(false);
  const [exportState, setExportState] = useState<{
    status: "idle" | "exporting" | "done" | "error";
    message?: string;
    rows?: number;
  }>({ status: "idle" });

  const { liveEvents, liveActors, pendingCount, paused, setPaused, consumePending } =
    useAuditLiveTail({ orgId, enabled: liveEnabled });

  // Pause the live tail when the reader scrolls away from the top — new
  // events queue behind the "resume" pill instead of shifting the list.
  useEffect(() => {
    function onScroll() {
      const down = window.scrollY > 400;
      setScrolledDown(down);
      if (down && liveEnabled && !paused) setPaused(true);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [liveEnabled, paused, setPaused]);

  const actorMap = useMemo(() => {
    const map = new Map<string, ActorInfo>();
    for (const a of actors) map.set(a.id, a);
    for (const [id, a] of liveActors) map.set(id, a);
    return map;
  }, [actors, liveActors]);

  const filtersClean =
    !hasActiveFilters(initialFilters) && initialFilters.page === 1;
  const showLiveInline = liveEnabled && !paused && !scrolledDown && filtersClean;
  const visibleEvents = showLiveInline ? [...liveEvents, ...initialEvents] : initialEvents;
  const showNewPill = liveEnabled && pendingCount > 0 && !showLiveInline;

  function pushFilters(patch: Partial<AuditFilters>) {
    const next = { ...initialFilters, ...patch };
    const params = filtersToSearchParams(next);
    const query = params.toString();
    router.replace(`/${orgSlug}/audit${query ? `?${query}` : ""}`, { scroll: false });
  }

  function resumeLive() {
    consumePending();
    setPaused(false);
    setScrolledDown(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleExport() {
    setExportState({ status: "exporting" });
    try {
      const result = await exportAuditCsv(orgSlug, {
        q: initialFilters.q,
        actions: initialFilters.actions,
        actorId: initialFilters.actorId,
        preset: initialFilters.preset,
        from: initialFilters.from,
        to: initialFilters.to,
      });
      if (!result.ok) {
        setExportState({ status: "error", message: result.error });
        return;
      }
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setExportState({ status: "done", rows: result.rows });
    } catch {
      setExportState({ status: "error", message: "Export failed — try again." });
    }
  }

  const totalPages = Math.max(1, Math.ceil(initialTotal / AUDIT_PAGE_SIZE));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every consequential action in this organization, in plain language.{" "}
            <span className="whitespace-nowrap">{AUDIT_RETENTION_LABEL}.</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <LiveTailToggle
            enabled={liveEnabled}
            onChange={(enabled) => {
              setLiveEnabled(enabled);
              if (enabled) {
                setPaused(false);
                consumePending();
              }
            }}
          />
          <ExportButton canExport={canExport} onExport={handleExport} state={exportState} />
        </div>
      </div>

      <AuditFilterBar filters={initialFilters} onChange={pushFilters} actorOptions={actorOptions} />

      {showNewPill ? (
        <button
          type="button"
          onClick={resumeLive}
          className={cn(
            "mx-auto flex items-center gap-2 rounded-full border bg-background px-4 py-1.5",
            "text-sm font-medium shadow-sm hover:bg-accent",
          )}
        >
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex size-2 rounded-full bg-primary" />
          </span>
          {pendingCount} new event{pendingCount === 1 ? "" : "s"} — resume live tail
        </button>
      ) : null}

      <AuditTable
        events={visibleEvents}
        actors={actorMap}
        onSelect={setSelected}
        hasFilters={hasActiveFilters(initialFilters)}
        onClearFilters={() =>
          pushFilters({
            q: "",
            actions: [],
            actorId: null,
            preset: "all",
            from: null,
            to: null,
            page: 1,
          })
        }
      />

      {totalPages > 1 ? (
        <nav aria-label="Audit log pages" className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={initialFilters.page <= 1}
            onClick={() => pushFilters({ page: initialFilters.page - 1 })}
          >
            <ChevronLeft className="size-4" />
            Newer
          </Button>
          <span className="text-sm text-muted-foreground tabular-nums">
            Page {initialFilters.page} of {totalPages} · {initialTotal} events
            {initialFilters.preset !== "all" || hasActiveFilters(initialFilters)
              ? ` · filtered (${describeFilters(initialFilters)})`
              : ""}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={initialFilters.page >= totalPages}
            onClick={() => pushFilters({ page: initialFilters.page + 1 })}
          >
            Older
            <ChevronRight className="size-4" />
          </Button>
        </nav>
      ) : (
        <p className="text-center text-sm text-muted-foreground tabular-nums">
          {initialTotal} event{initialTotal === 1 ? "" : "s"}
          {hasActiveFilters(initialFilters)
            ? ` matching these filters (${describeFilters(initialFilters)})`
            : ""}
        </p>
      )}

      <AuditDetailDrawer
        event={selected}
        actor={selected ? (actorMap.get(selected.actor_id) ?? null) : null}
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
