"use client";

import { useRouter, useSearchParams } from "next/navigation";

export interface WhoOption {
  value: string;
  label: string;
}

/** G-03 filter bar: search, who, kind and range — all state lives in
    the URL. The "Done by" options come from the server: the actors who
    actually appear in this workspace's audit log. */
export function AuditFilters({
  q,
  who,
  kind,
  range,
  whoOptions,
}: {
  q: string;
  who: string;
  kind: string;
  range: string;
  whoOptions: WhoOption[];
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
    <>
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
        <span className="gov-search">
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <circle cx="7" cy="7" r="4.5" />
            <path d="m10.5 10.5 3.5 3.5" />
          </svg>
          <input
            id="q"
            name="q"
            className="in"
            placeholder="Person, role or team"
            style={{ width: 230 }}
            defaultValue={q}
          />
        </span>
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
        {whoOptions.map((o) => (
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
    </>
  );
}
