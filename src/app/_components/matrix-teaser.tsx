"use client";

import { useState } from "react";
import { Ban, Check, Minus } from "lucide-react";

import { SIGNATURE_PERMISSIONS, TRUTH_LEDGER } from "@/lib/demo/truth-ledger";
import { RoleBadge } from "@/components/roles/role-badge";
import { RoleSeal } from "@/components/crew/role-seal";
import { cn } from "@/lib/utils";

type TriState = "Allow" | "Deny" | "Inherit";

const STATE_META: Record<TriState, { icon: typeof Check; className: string; label: string }> = {
  Allow: { icon: Check, className: "text-success", label: "Allowed" },
  Deny: { icon: Ban, className: "text-destructive", label: "Denied" },
  Inherit: { icon: Minus, className: "text-muted-foreground", label: "Inherited" },
};

/**
 * Landing hero teaser: the permission register with Allow / Deny / Inherit
 * toggles. Flipping a toggle lights up the matching line on Maya Jordan's
 * access card — the register and the member stay visibly in sync.
 */
export function MatrixTeaser() {
  const [states, setStates] = useState<Record<string, TriState>>(() =>
    Object.fromEntries(
      SIGNATURE_PERMISSIONS.flatMap((g) => g.rules.map((r) => [r.label, r.state])),
    ),
  );

  const member = TRUTH_LEDGER.people[0] as (typeof TRUTH_LEDGER.people)[number];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      {/* Register */}
      <div className="border bg-card p-6 shadow-sm md:p-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Permission register</h2>
          <span className="text-xs text-muted-foreground">6 shown · 18 total</span>
        </div>
        <div className="flex flex-col gap-5">
          {SIGNATURE_PERMISSIONS.map((group) => (
            <section key={group.group} aria-label={group.group}>
              <div className="register-group-title border-t-2 border-foreground pt-2 pb-1">
                <span>{group.group}</span>
                <span className="text-muted-foreground">{group.rules.length} rules</span>
              </div>
              {group.rules.map((rule) => (
                <div
                  key={rule.label}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{rule.label}</p>
                    <p className="text-xs text-muted-foreground">{rule.description}</p>
                  </div>
                  <span
                    role="group"
                    aria-label={`${rule.label} access`}
                    className="permission-state shrink-0"
                  >
                    {(["Allow", "Deny", "Inherit"] as TriState[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={states[rule.label] === s}
                        onClick={() =>
                          setStates((prev) => ({ ...prev, [rule.label]: s }))
                        }
                        className={states[rule.label] === s ? "selected" : undefined}
                      >
                        {s}
                      </button>
                    ))}
                  </span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>

      {/* Member access card */}
      <div className="flex flex-col">
        <p className="mb-2 text-xs font-semibold tracking-[0.13em] uppercase text-muted-foreground">
          Fictional member
        </p>
        <div className="border border-primary/40 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex size-12 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
            >
              MJ
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">{member.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <RoleSeal>{member.registerNo}</RoleSeal>
                <RoleBadge roleName={member.role} />
              </div>
            </div>
          </div>
          <ul className="mt-5 flex flex-col gap-2.5 border-t pt-4">
            {SIGNATURE_PERMISSIONS.flatMap((g) =>
              g.rules.map((rule) => {
                const state: TriState = states[rule.label] ?? "Inherit";
                const meta = STATE_META[state];
                const Icon = meta.icon;
                return (
                  <li key={rule.label} className="flex items-center gap-2.5 text-sm">
                    <Icon className={cn("size-4 shrink-0", meta.className)} aria-hidden />
                    <span className="font-medium">{rule.label}</span>
                    <span className="sr-only">: {meta.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{state}</span>
                  </li>
                );
              }),
            )}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Flip a toggle in the register — this card updates to match. That’s the whole
            product: access everyone can explain.
          </p>
        </div>
      </div>
    </div>
  );
}
