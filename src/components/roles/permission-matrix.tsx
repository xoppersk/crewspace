"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Minus, Plus, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { diffPermissionKeys, isDiffEmpty } from "@/lib/roles/diff";

/**
 * PermissionMatrix — the Crewspace differentiator, in the Signature UI's
 * register language: uppercase group titles with rule counts, rows that
 * state each permission's effect in plain language, and the dark review bar
 * ("Changes ready · affects N members").
 *
 * Resources as grouped rows (Organization, Members, Teams, Roles,
 * Invitations, Audit log, Settings, Billing); actions as toggle cells with
 * plain-language tooltips. System roles render read-only with a
 * "Clone to customize" affordance; custom roles get a sticky
 * "Review changes" bar showing the diff (+2/−1 keys) and the affected-member
 * count. Confirm applies via the parent's server action.
 *
 * Keyboard: every toggle is a native switch (Tab + Space), plus arrow-key
 * group navigation across the whole matrix. Touch: ≥44px targets on mobile,
 * where the matrix collapses to an accordion (one resource group open at a
 * time). Status is never color-alone: counts are always paired with words
 * and icons.
 */

export interface PermissionMatrixProps {
  catalog: ResourceGroup[];
  /** The saved key set — the diff baseline. */
  initialKeys: string[];
  /** System roles: locked toggles + clone affordance. */
  readOnly?: boolean;
  /** Controlled mode (role wizard): hides the review bar. */
  value?: string[];
  onValueChange?: (keys: string[]) => void;
  /** Active memberships holding the role — shown in the review bar. */
  affectedMemberCount?: number;
  /** Detail mode: called with the edited key set on Confirm. */
  onConfirm?: (nextKeys: string[]) => Promise<{ ok: boolean; error?: string }>;
  confirmLabel?: string;
  onCloneRequest?: () => void;
}

export function PermissionMatrix({
  catalog,
  initialKeys,
  readOnly = false,
  value,
  onValueChange,
  affectedMemberCount,
  onConfirm,
  confirmLabel = "Review changes",
  onCloneRequest,
}: PermissionMatrixProps) {
  const [internalKeys, setInternalKeys] = useState<string[]>(initialKeys);
  const [openResource, setOpenResource] = useState<string | null>(
    catalog[0]?.resource ?? null,
  );
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const controlled = value !== undefined;
  const keys = controlled ? value : internalKeys;

  const diff = useMemo(() => diffPermissionKeys(initialKeys, keys), [initialKeys, keys]);
  const dirty = !readOnly && !isDiffEmpty(diff) && onConfirm !== undefined;

  function setKeys(next: string[]) {
    if (controlled) {
      onValueChange?.(next);
    } else {
      setInternalKeys(next);
    }
    setConfirmError(null);
  }

  function toggle(key: string) {
    if (readOnly) return;
    setKeys(keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]);
  }

  function discard() {
    setKeys(initialKeys);
  }

  async function confirm() {
    if (!onConfirm || confirming) return;
    setConfirming(true);
    setConfirmError(null);
    try {
      const result = await onConfirm(keys);
      if (!result.ok) {
        setConfirmError(result.error ?? "Couldn't save changes. Try again.");
      } else {
        // Success: the parent revalidates, so fresh initialKeys arrive and
        // the bar disappears. Sync local state in case it doesn't.
        if (!controlled) setInternalKeys(keys);
      }
    } catch (error) {
      setConfirmError(error instanceof Error ? error.message : "Couldn't save changes.");
    } finally {
      setConfirming(false);
    }
  }

  // Arrow-key group navigation across every switch in the matrix.
  function onMatrixKeyDown(event: React.KeyboardEvent) {
    if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    const target = event.target as HTMLElement;
    if (!target.hasAttribute("data-matrix-switch")) return;
    const switches = Array.from(
      containerRef.current?.querySelectorAll<HTMLElement>("[data-matrix-switch]") ?? [],
    );
    const index = switches.indexOf(target);
    if (index === -1) return;
    event.preventDefault();
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    const next = switches[(index + delta + switches.length) % switches.length];
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
              keys={keys}
              readOnly={readOnly}
              onToggle={toggle}
            />
          ))}
        </div>

        {/* Mobile: accordion, one group open at a time, ≥44px targets */}
        <div className="md:hidden">
          {catalog.map((group) => {
            const open = openResource === group.resource;
            const enabled = group.permissions.filter((p) => keys.includes(p.key)).length;
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
                      {enabled} of {group.permissions.length} on
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
                        checked={keys.includes(permission.key)}
                        readOnly={readOnly}
                        onToggle={() => toggle(permission.key)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {/* Sticky review bar — the dark signature bar */}
        {dirty ? (
          <div
            aria-live="polite"
            className="sticky bottom-4 z-10 mt-6 flex flex-wrap items-center justify-between gap-3 bg-foreground px-4 py-3 text-white shadow-lg"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-semibold">Changes ready</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/80">
                <span className="inline-flex items-center gap-1.5">
                  {diff.added.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-emerald-300">
                      <Plus className="size-3.5" /> {diff.added.length} added
                    </span>
                  ) : null}
                  {diff.removed.length > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-red-300">
                      <Minus className="size-3.5" /> {diff.removed.length} removed
                    </span>
                  ) : null}
                </span>
                {typeof affectedMemberCount === "number" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    Affects {affectedMemberCount} member{affectedMemberCount === 1 ? "" : "s"}
                  </span>
                ) : null}
              </span>
              {confirmError ? (
                <p role="alert" className="w-full text-sm text-red-300">
                  {confirmError}
                </p>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={discard}
                disabled={confirming}
                className="text-white hover:bg-white/10 hover:text-white"
              >
                Discard
              </Button>
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
  keys,
  readOnly,
  onToggle,
}: {
  group: ResourceGroup;
  keys: string[];
  readOnly: boolean;
  onToggle: (key: string) => void;
}) {
  const enabled = group.permissions.filter((p) => keys.includes(p.key)).length;
  return (
    <section aria-label={group.label} className="border-t-2 border-foreground pt-2 pb-4">
      <div className="register-group-title px-1 pb-1">
        <span>{group.label}</span>
        <span className="text-muted-foreground">
          {enabled} of {group.permissions.length} rules
        </span>
      </div>
      <div>
        {group.permissions.map((permission) => (
          <DesktopPermissionRow
            key={permission.key}
            permission={permission}
            checked={keys.includes(permission.key)}
            readOnly={readOnly}
            onToggle={() => onToggle(permission.key)}
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

function DesktopPermissionRow({
  permission,
  checked,
  readOnly,
  onToggle,
}: {
  permission: CatalogPermission;
  checked: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "grid grid-cols-[1fr_auto] items-center gap-4 border-b px-1 py-3",
        !readOnly && "cursor-pointer",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <PermissionLabel permission={permission} />
        {permission.description ? (
          <span className="text-xs text-muted-foreground">{permission.description}</span>
        ) : null}
      </span>
      {readOnly ? (
        <span
          role="img"
          aria-label={checked ? "Granted (locked)" : "Not granted (locked)"}
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full border text-[11px] font-bold",
            checked ? "border-success text-success" : "border-muted-foreground/30 text-muted-foreground/50",
          )}
        >
          {checked ? "✓" : "–"}
        </span>
      ) : (
        <Switch
          data-matrix-switch=""
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={permission.label}
        />
      )}
    </label>
  );
}

function MobilePermissionRow({
  permission,
  checked,
  readOnly,
  onToggle,
}: {
  permission: CatalogPermission;
  checked: boolean;
  readOnly: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-[44px] w-full items-center justify-between gap-4 px-1 py-2.5",
        !readOnly && "cursor-pointer active:bg-muted/50",
      )}
    >
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-semibold">{permission.label}</span>
        {permission.description ? (
          <span className="text-xs text-muted-foreground">{permission.description}</span>
        ) : null}
      </span>
      {readOnly ? (
        <span
          role="img"
          aria-label={checked ? "Granted (locked)" : "Not granted (locked)"}
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
            checked ? "border-success text-success" : "border-muted-foreground/30 text-muted-foreground/50",
          )}
        >
          {checked ? "✓" : "–"}
        </span>
      ) : (
        <Switch
          data-matrix-switch=""
          checked={checked}
          onCheckedChange={onToggle}
          aria-label={permission.label}
          className="shrink-0"
        />
      )}
    </label>
  );
}
