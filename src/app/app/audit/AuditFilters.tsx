"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface WhoOption {
  value: string;
  label: string;
}

/** The screen's fixed "Done by" list (AuditLog.html), independent of which
    actors happen to appear in the fixture. Values are member register ids;
    "system" matches the fixture's system entries. */
const WHO_OPTIONS: WhoOption[] = [
  { value: "001", label: "Sheku Koroma" },
  { value: "017", label: "Daniel Okafor" },
  { value: "011", label: "Owen Clarke" },
  { value: "system", label: "System" },
];

/** G-03 filter bar: search, who, kind and range — all state lives in the URL. */
export function AuditFilters({
  q,
  who,
  kind,
  range,
}: {
  q: string;
  who: string;
  kind: string;
  range: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function push(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (!v || v === "all" || (k === "kind" && v === "access") || (k === "range" && v === "7")) {
        p.delete(k);
      } else {
        p.set(k, v);
      }
    }
    const qs = p.toString();
    router.push(qs ? `/app/audit?${qs}` : "/app/audit");
  }

  const selectStyle: React.CSSProperties = { height: 36 };

  return (
    <div
      role="search"
      style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          push({ q: String(data.get("q") ?? "") });
        }}
      >
        <label htmlFor="q" className="sr-only">
          Search
        </label>
        <input
          id="q"
          name="q"
          className="in"
          placeholder="Person, role or team"
          style={{ width: 220 }}
          defaultValue={q}
        />
      </form>

      <label htmlFor="who" className="sr-only">
        Done by
      </label>
      <select
        id="who"
        className="in"
        style={selectStyle}
        value={who}
        onChange={(e) => push({ who: e.target.value })}
      >
        <option value="all">Anyone</option>
        {WHO_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <label htmlFor="what" className="sr-only">
        Kind
      </label>
      <select
        id="what"
        className="in"
        style={selectStyle}
        value={kind}
        onChange={(e) => push({ kind: e.target.value })}
      >
        <option value="access">Access changes only</option>
        <option value="all">Everything, including sign-ins</option>
        <option value="roles">Roles</option>
        <option value="invitations">Invitations</option>
        <option value="sessions">Sessions</option>
      </select>

      <label htmlFor="rng" className="sr-only">
        Range
      </label>
      <select
        id="rng"
        className="in"
        style={selectStyle}
        value={range}
        onChange={(e) => push({ range: e.target.value })}
      >
        <option value="7">Last 7 days</option>
        <option value="30">Last 30 days</option>
        <option value="quarter">This quarter</option>
      </select>
    </div>
  );
}
