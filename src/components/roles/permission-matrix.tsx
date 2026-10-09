"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  type CatalogPermission,
  type ResourceGroup,
} from "@/lib/roles/catalog";
import {
  decisionsFromStates,
  diffPermissionStates,
  isStateDiffEmpty,
  statesFromDecisions,
  type PermissionDecisions,
  type PermissionState,
} from "@/lib/roles/diff";

/**
 * PermissionMatrix — the Crewspace differentiator, in the Signature UI's
 * register language (Flagship UI Designs artifact): uppercase group titles
 * with rule counts, rows that state each permission's effect in plain
 * language, an Allow / Deny / Inherit segmented control with text labels
 * and an explicit selected state on every row, and the dark review bar
 * ("Changes ready · affects N members" + "Review changes").
 *
 * Decision model: Allow grants the key, Deny records an explicit denial,
 * Inherit leaves the key undecided so the organization baseline applies.
 * System roles render read-only with a "Clone to customize" affordance;
 * custom roles get the dark review bar once a decision changes.
 *
 * Keyboard: every control is a native button group (Tab + arrows).
 * Touch: ≥44px targets on mobile, where the matrix collapses to an
 * accordion (one resource group open at a time). Status is never
 * color-alone: selected buttons carry a "✓ " prefix plus the label text.
 */

const STATES: PermissionState[] = ["allow", "deny", "inherit"];
const STATE_LABELS: Record<PermissionState, string> = {
  allow: "Allow",
  deny: "Deny",
  inherit: "Inherit",
};

export interface PermissionMatrixProps {
  catalog: ResourceGroup[];
  /** The saved decisions — the diff baseline. */
  initialDecisions: PermissionDecisions;
  /** System roles: locked controls + clone affordance. */
  readOnly?: boolean;
  /** Controlled mode (role wizard): hides the review bar. */
  value?: Record<string, PermissionState>;
  onValueChange?: (states: Record<string, PermissionState>) => void;
  /** Active memberships holding the role — shown in the review bar. */
  affectedMemberCount?: number;
  /** Detail mode: called with the edited decisions on "Review changes". */
  onConfirm?: (decisions: PermissionDecisions) => Promise<{ ok: boolean; error?: string }>;
  confirmLabel?: string;
  onCloneRequest?: () => void;
}

export function PermissionMatrix({
  catalog,
  initialDecisions,
  readOnly = false,
  value,
  onValueChange,
  affectedMemberCount,
  onConfirm,
  confirmLabel = "Review changes",
  onCloneRequest,
}: PermissionMatrixProps) {
  const [overrides, setOverrides] = useState<Record<string, PermissionState>>({});
  const [openResource, setOpenResource] = useState<string | null>(
    catalog[0]?.resource ?? null,
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const controlled = value !== undefined;
  const baselineStates = useMemo(() => statesFromDecisions(initialDecisions), [initialDecisions]);

  // Reset local edits whenever the saved baseline changes (e.g. the parent
  // revalidates after a successful save).
  const baselineKey = JSON.stringify(initialDecisions);
  const [lastBaselineKey, setLastBaselineKey] = useState(baselineKey);
  if (lastBaselineKey !== baselineKey) {
    setLastBaselineKey(baselineKey);
    setOverrides({});
  }

  const states = useMemo(() => {
    if (controlled) return value;
    const merged = { ...baselineStates };
    for (const [key, decision] of Object.entries(overrides)) {
      if (decision === "inherit") {
        delete merged[key];
      } else {
        merged[key] = decision;
      }
    }
    return merged;
  }, [controlled, value, baselineStates, overrides]);

  const diff = useMemo(
    () =>
      diffPermissionStates(decisionsFromStates(baselineStates), decisionsFromStates(states)),
    [baselineStates, states],
  );
  const dirty = !readOnly && !isStateDiffEmpty(diff) && onConfirm !== undefined;

  function setDecision(key: string, decision: PermissionState) {
    if (readOnly) return;
    if (controlled) {
      const next = { ...states };
      if (decision === "inherit") {
        delete next[key];
      } else {
        next[key] = decision;
      }
      onValueChange?.(next);
    } else {
      setOverrides((prev) => ({ ...prev, [key]: decision }));
    }
    setConfirmError(null);
  }

  async function confirm() {
    if (!onConfirm || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const result = await onConfirm(decisionsFromStates(states));
      if (!result.ok) {
        setConfirmError(result.error ?? "Couldn't save changes. Try again.");
      } else if (!controlled) {
        // Success: clear local edits — the parent revalidates and the fresh
        // baseline arrives, so the bar disappears.
        setOverrides({});
      }
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Couldn't save changes.");
    } finally {
      setConfirming(false);
    }
  }

  // Arrow-key navigation across every permission-state button.
  function onMatrixKeyDown(event: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute("data-permission-button")) return;
    const buttons = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>("[data-permission-button]") ?? [],
    );
    const index = buttons.indexOf(target);
    if (index === -1) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next = buttons[(index + delta + buttons.length) % buttons.length];
    next?.focus();
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div ref={containerRef} onKeyDown={onMatrixKeyDown}>
        {readOnly ? (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-l-3 border-primary bg-primary-soft px-4 py-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">System role — read-only.</span>{" "}
              These permissions are locked to keep the org safe.
            </p>
            {onCloneRequest ? (
              <Button variant="outline" size="sm" onClick={onCloneRequest}>
                <Copy className="size-4" /> Clone to customize
              </Button>
            ) : null}
          </div>
        ) : null}

        {/* Desktop: grouped register */}
        <div className="hidden md:block">
          {catalog.map((group) => (
            <GroupSection
              key={group.resource}
              group={group}
              states={states}
              readOnly={readOnly}
              onDecision={setDecision}
            />
          ))}
        </div>

        {/* Mobile: accordion, one group open at a time, ≥44px targets */}
        <div className="md:hidden">
          {catalog.map((group) => {
            const open = openResource === group.resource;
            const decided = group.permissions.filter((p) => states[p.key] !== undefined).length;
            return (
              <div key={group.resource} className="border-b last:border-b-0">
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenResource(open ? null : group.resource)}
                  className="flex min-h-[44px] w-full items-center justify-between gap-3 py-3 text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{group.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {decided} of {group.permissions.length} decided
                    </span>
                  </span>
                  <ChevronDown
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
                  />
                </button>
                {open ? (
                  <div className="pb-2">
                    {group.permissions.map((permission) => (
                      <MobilePermissionRow
                        key={permission.key}
                        permission={permission}
                        decision={states[permission.key] ?? "inherit"}
                        readOnly={readOnly}
                        onDecision={(decision) => setDecision(permission.key, decision)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Dark review bar — the signature bar. Appears when a decision changes. */}
        {dirty ? (
          <div
            aria-live="polite"
            className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-sm bg-foreground px-4 py-3 text-white shadow-lg"
          >
            <span className="text-sm font-semibold">
              Changes ready · affects {affectedMemberCount ?? 0} member
              {(affectedMemberCount ?? 0) === 1 ? "" : "s"}
            </span>
            <div className="flex items-center gap-2">
              {confirmError ? (
                <p role="alert" className="text-sm text-red-300">
                  {confirmError}
                </p>
              ) : null}
              <Button
                onClick={confirm}
                disabled={confirming}
                className="bg-primary text-white hover:bg-primary-hover"
              >
                {confirming ? "Saving…" : confirmLabel}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}

function GroupSection({
  group,
  states,
  readOnly,
  onDecision,
}: {
  group: ResourceGroup;
  states: Record<string, PermissionState>;
  readOnly: boolean;
  onDecision: (key: string, decision: PermissionState) => void;
}) {
  return (
    <section aria-label={group.label} className="border-t-2 border-foreground pt-2 pb-4">
      <div className="register-group-title px-1 pb-1">
        <span>{group.label}</span>
        <span className="text-muted-foreground">{group.permissions.length} rules</span>
      </div>
      <div>
        {group.permissions.map((permission) => (
          <DesktopPermissionRow
            key={permission.key}
            permission={permission}
            decision={states[permission.key] ?? "inherit"}
            readOnly={readOnly}
            onDecision={(decision) => onDecision(permission.key, decision)}
          />
        ))}
      </div>
    </section>
  );
}

function PermissionLabel({ permission }: { permission: CatalogPermission }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="cursor-help text-sm font-semibold underline decoration-dotted decoration-muted-foreground/50 underline-offset-4">
          {permission.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60">
        {permission.description ?? permission.key}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The register's Allow / Deny / Inherit segmented control — text labels
 * with an explicit selected state (Flagship UI Designs artifact).
 */
function PermissionStateControl({
  decision,
  readOnly,
  onDecision,
  label,
}: {
  decision: PermissionState;
  readOnly: boolean;
  onDecision: (decision: PermissionState) => void;
  label: string;
}) {
  return (
    <span
      className="permission-state"
      role="group"
      aria-label={`${label} access decision`}
    >
      {STATES.map((state) => (
        <button
          key={state}
          type="button"
          data-permission-button=""
          disabled={readOnly}
          aria-pressed={decision === state}
          aria-label={`${STATE_LABELS[state]}: ${label}`}
          className={decision === state ? "selected" : undefined}
          onClick={() => onDecision(state)}
        >
          {STATE_LABELS[state]}
        </button>
      ))}
    </span>
  );
}

function DesktopPermissionRow({
  permission,
  decision,
  readOnly,
  onDecision,
}: {
  permission: CatalogPermission;
  decision: PermissionState;
  readOnly: boolean;
  onDecision: (decision: PermissionState) => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b px-1 py-3">
      <span className="flex min-w-0 flex-col gap-0.5">
        <PermissionLabel permission={permission} />
        {permission.description ? (
          <span className="text-xs text-muted-foreground">{permission.description}</span>
        ) : null}
      </span>
      <PermissionStateControl
        decision={decision}
        readOnly={readOnly}
        onDecision={onDecision}
        label={permission.label}
      />
    </div>
  );
}

function MobilePermissionRow({
  permission,
  decision,
  readOnly,
  onDecision,
}: {
  permission: CatalogPermission;
  decision: PermissionState;
  readOnly: boolean;
  onDecision: (decision: PermissionState) => void;
}) {
  return (
    <div className="flex min-h-[44px] w-full flex-col justify-center gap-2 px-1 py-2.5">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{permission.label}</span>
        {permission.description ? (
          <span className="text-xs text-muted-foreground">{permission.description}</span>
        ) : null}
      </span>
      <PermissionStateControl
        decision={decision}
        readOnly={readOnly}
        onDecision={onDecision}
        label={permission.label}
      />
    </div>
  );
}
