"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { importInvitations } from "@/lib/data/actions";
import { getSeats, importCounts, type WorkspaceData } from "@/lib/api";
import type { ImportRow } from "@/lib/types";
import { Button } from "@/components/Button";
import { DecisionRows, type RowResolution } from "./DecisionRows";

/**
 * G-02 CSV import — the real flow:
 * 1) Upload a CSV (parsed in the browser; nothing is sent anywhere).
 * 2) Check: each row is evaluated against the workspace's real data —
 *    already a member / already invited → skipped; personal email or
 *    an unrecognized role → needs a decision; everything else ready.
 * 3) Send: ready + resolved rows become real invitation rows through
 *    the importInvitations server action (permission-checked,
 *    audit-logged).
 */

const PERSONAL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

const HEADER_ALIASES: Record<string, string[]> = {
  email: ["email", "email address", "work email", "e-mail"],
  name: ["name", "full name", "person"],
  role: ["role", "position", "title"],
  team: ["team", "dept", "department", "group"],
};
const FIELD_LABELS: Record<string, string> = {
  email: "Work email",
  name: "Name",
  role: "Role",
  team: "Team",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

export function CsvImport({ data }: { data: WorkspaceData }) {
  const router = useRouter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [mapping, setMapping] = useState<{ from: string; to: string }[]>([]);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, RowResolution>>({});
  const [busy, setBusy] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const roles = data.org.roles;
  const roleNames = useMemo(() => roles.map((r) => r.name), [roles]);
  const guestRole = roles.find((r) => r.id === "guest");
  const memberEmails = useMemo(
    () => new Set(data.members.map((m) => m.email.toLowerCase())),
    [data.members],
  );
  const invitedEmails = useMemo(
    () =>
      new Set(
        data.invitations
          .filter((i) => i.status === "open" || i.status === "bounced")
          .map((i) => i.email.toLowerCase()),
      ),
    [data.invitations],
  );
  const seats = getSeats(data);

  function evaluate(headers: string[], body: string[][]): ImportRow[] {
    const col = (field: string) =>
      headers.findIndex((h) =>
        (HEADER_ALIASES[field] ?? []).includes(h.trim().toLowerCase()),
      );
    const idx = {
      email: col("email"),
      name: col("name"),
      role: col("role"),
      team: col("team"),
    };
    setMapping(
      headers.map((h, i) => {
        const field = (Object.keys(HEADER_ALIASES) as string[]).find(
          (f) => idx[f as keyof typeof idx] === i,
        );
        return { from: h, to: field ? FIELD_LABELS[field]! : "Not used" };
      }),
    );
    return body.map((cells, i) => {
      const get = (k: keyof typeof idx) =>
        idx[k] >= 0 ? (cells[idx[k]] ?? "").trim() : "";
      const email = get("email");
      const name = get("name") || email;
      const roleName = get("role");
      const teamName = get("team");
      const base = {
        row: i + 1,
        name,
        email,
        role: roleName,
        team: teamName,
      };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return { ...base, status: "fix" as const, issue: "Invalid email", fix: "Fix the address or leave the row out." };
      }
      if (memberEmails.has(email.toLowerCase())) {
        return { ...base, status: "skipped" as const, issue: "Already a member", fix: "Their role and teams stay as they are." };
      }
      if (invitedEmails.has(email.toLowerCase())) {
        return { ...base, status: "skipped" as const, issue: "Already invited", fix: "The open invitation stays as it is." };
      }
      const domain = email.split("@")[1]?.toLowerCase() ?? "";
      if (PERSONAL_DOMAINS.has(domain)) {
        return { ...base, status: "fix" as const, issue: "Personal email", fix: "Joins as Guest, or leave out." };
      }
      if (
        roleName &&
        !roles.some((r) => r.name.toLowerCase() === roleName.toLowerCase())
      ) {
        return { ...base, status: "fix" as const, issue: "Role not recognized", fix: "Choose a role from the register." };
      }
      return { ...base, status: "ready" as const };
    });
  }

  async function onFile(file: File) {
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setFileName(file.name);
      setRows([]);
      return;
    }
    const [headers, ...body] = parsed;
    setFileName(file.name);
    setResolutions({});
    setRows(evaluate(headers!, body));
    setSentNote(null);
  }

  const counts = rows ? importCounts(rows, seats) : null;
  const decisionRows = rows
    ? [
        ...rows.filter((r) => r.status === "fix"),
        ...rows.filter((r) => r.status === "skipped"),
      ]
    : [];
  const readyRows = rows ? rows.filter((r) => r.status === "ready") : [];
  const breakdown = new Map<string, number>();
  for (const r of readyRows) {
    const key = `${r.role || "Member"}, ${r.team || "No team"}`;
    breakdown.set(key, (breakdown.get(key) ?? 0) + 1);
  }
  const breakdownRows = [...breakdown.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  const maxBreakdown = Math.max(...breakdownRows.map(([, n]) => n), 1);

  function resolutionFor(row: ImportRow): RowResolution {
    const stored = resolutions[row.row];
    if (stored) return stored;
    if (/personal/i.test(row.issue ?? "") && guestRole) {
      return { send: true, roleName: guestRole.name };
    }
    return { send: false, roleName: row.role };
  }

  const sendable = rows
    ? [
        ...readyRows.map((r) => ({ row: r, res: { send: true, roleName: r.role || "Member" } as RowResolution })),
        ...rows
          .filter((r) => r.status === "fix")
          .map((r) => ({ row: r, res: resolutionFor(r) }))
          .filter((x) => x.res.send),
      ]
    : [];

  async function send() {
    setBusy(true);
    setSentNote(null);
    const payload = sendable.map(({ row, res }) => {
      const role = roles.find(
        (r) => r.name.toLowerCase() === res.roleName.toLowerCase(),
      );
      const team = data.teams.find(
        (t) => t.name.toLowerCase() === row.team.toLowerCase(),
      );
      return {
        email: row.email,
        roleId: role?.id ?? "member",
        teamId: team?.id,
      };
    });
    const res = await importInvitations(payload);
    setBusy(false);
    if (!res.ok) {
      setSentNote(res.error);
      return;
    }
    setSentNote(
      `${res.created ?? 0} invitation${res.created === 1 ? "" : "s"} created. Find them under Invitations.`,
    );
    router.refresh();
  }

  return (
    <>
      <nav aria-label="Steps" className="card gov-steps">
        <div className="stp done">
          <span className="sr-only">Step 1</span>
          <span className="n" aria-hidden="true">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8.5l3 3 7-7" />
            </svg>
          </span>
          <span className="stp-text">
            <b>Upload</b>
            <br />
            <span className="stp-file">{fileName ?? "Choose a CSV file"}</span>
          </span>
        </div>
        <div className={rows ? "stp current" : "stp"} aria-current={rows ? "step" : undefined}>
          <span className="n">2</span>
          <span className="stp-text">
            <b>Check</b>
            <br />
            <span className="stp-sub">{rows ? `${rows.length} rows read` : "Waiting for a file"}</span>
          </span>
        </div>
        <div className="stp todo">
          <span className="n">3</span>
          <span className="stp-text">Send</span>
        </div>
      </nav>

      {!rows ? (
        <section className="card" style={{ padding: 24, maxWidth: 720 }}>
          <h1 className="gov-title">Import members from a CSV</h1>
          <p className="gov-lede">
            Choose a file with columns for email, name, role and team.
            It’s read here first — nothing is sent until you check the
            rows and press Send.
          </p>
          <label className="btn pri" style={{ height: 44, display: "inline-flex", cursor: "pointer" }}>
            Choose CSV file
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
        </section>
      ) : (
        <div
          style={{
            flex: "999 1 820px",
            minWidth: 0,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 340px",
            gap: 20,
            alignItems: "start",
          }}
          className="gov-inv-cols"
        >
          <main style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "8px 0 2px" }}>
              <h1 className="gov-title">
                {counts!.ready} ready, {counts!.fix} to fix, {counts!.skipped} skipped
              </h1>
              <p className="gov-lede">
                Nothing is sent yet. Fix the {counts!.fix} rows below or
                leave them out; the ready rows go out together when you
                send.
              </p>
            </div>

            <section className="card" aria-labelledby="fx" style={{ overflow: "hidden" }}>
              <div className="gov-sheet-head" style={{ padding: "18px 22px" }}>
                <h2 id="fx">Needs a decision</h2>
                <span className="spacer" style={{ fontSize: 12.5, color: "var(--muted)" }}>
                  {decisionRows.length} of {rows.length} rows
                </span>
              </div>
              <div className="rows-scroll">
                <DecisionRows
                  rows={decisionRows}
                  roleNames={roleNames}
                  guestRoleName={guestRole?.name}
                  onResolve={(row, res) =>
                    setResolutions((r) => ({ ...r, [row]: res }))
                  }
                />
              </div>
            </section>

            <section className="card" aria-labelledby="rd" style={{ padding: "18px 22px 10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, paddingBottom: 8 }}>
                <h2 id="rd" style={{ margin: 0, font: "700 17px/1.2 var(--font-sans)" }}>
                  Ready · {counts!.ready}
                </h2>
              </div>
              {breakdownRows.map(([label, n]) => (
                <div className="gov-ready-row" key={label}>
                  <span>{label}</span>
                  <span className="track" aria-hidden="true">
                    <i style={{ width: `${(n / maxBreakdown) * 100}%` }} />
                  </span>
                  <span className="n">{n}</span>
                </div>
              ))}
            </section>
          </main>

          <aside style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <section className="card" aria-labelledby="mp" style={{ padding: "18px 18px 8px" }}>
              <h2 id="mp" style={{ margin: "0 0 8px", font: "700 15px/1.3 var(--font-sans)" }}>
                How your columns were read
              </h2>
              <div>
                {mapping.map((m) => (
                  <div className="gov-mp" key={m.from}>
                    <span className="gov-rno">{m.from}</span>
                    <span aria-hidden="true" style={{ color: "var(--muted)" }}>
                      →
                    </span>
                    <span style={m.to === "Not used" ? { color: "var(--muted)" } : undefined}>
                      {m.to}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="dpanel" aria-labelledby="se" style={{ fontSize: 13, lineHeight: 1.5, gap: 12 }}>
              <h2 id="se">Seats</h2>
              <span style={{ color: "var(--panel-muted)" }}>
                {seats.used} seats are used and {seats.held} are held by
                open invitations. Sending these {sendable.length} would
                bring the total to{" "}
                <b style={{ fontWeight: 600, color: "#fff" }}>
                  {counts!.seatsNeeded} of your {seats.total}
                </b>
                .
              </span>
              <div className="dchg" style={{ color: "#c9d0da" }}>
                Seats are charged only when people accept, at $
                {data.org.plan.pricePerSeat} a month each.
              </div>
              <Link href="/app/settings/billing" style={{ fontWeight: 600, color: "var(--panel-allow)" }}>
                Plan and billing
              </Link>
              {sentNote ? (
                <span style={{ color: "#fff" }}>{sentNote}</span>
              ) : null}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr", gap: 8, paddingTop: 4 }}>
                <Link href="/app/invitations" className="btn on-dark" style={{ justifyContent: "center" }}>
                  Cancel
                </Link>
                <Button
                  variant="white"
                  disabled={busy || sendable.length === 0}
                  onClick={() => void send()}
                  style={{ justifyContent: "center" }}
                >
                  Send {sendable.length} invitation{sendable.length === 1 ? "" : "s"}
                </Button>
              </div>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
