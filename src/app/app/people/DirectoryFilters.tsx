"use client";

import { useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getRole, getTeam } from "@/lib/api";

/* The Directory filter bar (P-02). The list renders server-side from the
   URL; this component only writes the URL (§10: UI state in the URL). */

const ROLE_OPTIONS = [
  { value: "product-admin", label: "Product admin" },
  { value: "support-lead", label: "Support lead" },
  { value: "analyst", label: "Analyst" },
  { value: "member", label: "Member" },
];

const TEAM_OPTIONS = [
  { value: "product", label: "Product" },
  { value: "customer-operations", label: "Customer operations" },
  { value: "engineering", label: "Engineering" },
];

export function DirectoryFilters({
  q,
  status,
  role,
  team,
  counts,
  params,
}: {
  q: string;
  status: string;
  role: string;
  team: string;
  counts: { all: number; active: number; invited: number; deactivated: number };
  /** Every current query param, serialized, so updates keep the rest. */
  params: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? "/app/people";
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const onSearch = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => update({ q: value.trim() === "" ? null : value }),
      300,
    );
  };

  const chips = [
    { value: "all", label: `All ${counts.all}` },
    { value: "active", label: `Active ${counts.active}` },
    { value: "invited", label: `Invited ${counts.invited}` },
    { value: "deactivated", label: `Deactivated ${counts.deactivated}` },
  ];

  /* A ?role= / ?team= outside the screen's options still filters (the page
     resolves it); show it as its own option so the select stays truthful. */
  const extraRole =
    role && !ROLE_OPTIONS.some((o) => o.value === role) ? role : null;
  const extraTeam =
    team && !TEAM_OPTIONS.some((o) => o.value === team) ? team : null;

  return (
    <div
      role="search"
      className="dir-filters"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
      <label htmlFor="q" className="sr-only">
        Find a person
      </label>
      <input
        id="q"
        className="in"
        placeholder="Name, email or number"
        style={{ width: 240 }}
        defaultValue={q}
        onChange={(e) => onSearch(e.target.value)}
      />
      <div role="group" aria-label="Status" style={{ display: "flex", gap: 6 }}>
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            className="fl"
            aria-pressed={status === chip.value}
            onClick={() => update({ status: chip.value })}
          >
            {chip.label}
          </button>
        ))}
      </div>
      <label htmlFor="r" className="sr-only">
        Role
      </label>
      <select
        id="r"
        className="in"
        value={role}
        onChange={(e) => update({ role: e.target.value || null })}
      >
        <option value="">Any role</option>
        {extraRole ? (
          <option value={extraRole}>
            {getRole(extraRole)?.name ?? extraRole}
          </option>
        ) : null}
        {ROLE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <label htmlFor="t" className="sr-only">
        Team
      </label>
      <select
        id="t"
        className="in"
        value={team}
        onChange={(e) => update({ team: e.target.value || null })}
      >
        <option value="">Any team</option>
        {extraTeam ? (
          <option value={extraTeam}>
            {getTeam(extraTeam)?.name ?? extraTeam}
          </option>
        ) : null}
        {TEAM_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
