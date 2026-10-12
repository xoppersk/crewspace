import Link from "next/link";
import type { Metadata } from "next";
import {
  directoryCounts,
  getDirectoryEntries,
  getDirectorySpotlight,
  getMember,
  getOfflineWindow,
  getRoles,
  getTeam,
  getTeams,
  type DirectoryEntry,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { InvitationRow, MemberRow } from "@/components/MemberRow";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { ConflictSheet } from "./ConflictSheet";
import { DirectoryDrawer } from "./DirectoryDrawer";
import { DirectoryFilters } from "./DirectoryFilters";

/**
 * P-02 Directory (+ P-03 drawer via ?open=, + X-06 via ?state=offline).
 * Default: the designed first page (spotlight). Any filter/search — or
 * "Show N more" (?show=all) — runs over all 45 entries.
 */

type SearchParams = {
  q?: string;
  status?: string;
  role?: string;
  team?: string;
  open?: string;
  state?: string;
  show?: string;
};

function serialize(sp: SearchParams, omit?: string): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value && key !== omit) params.set(key, value);
  }
  return params.toString();
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const sp = await searchParams;
  if (sp.state === "offline") return { title: "Crewspace — Reconnecting" };
  if (sp.open) {
    const member = getMember(sp.open);
    if (member)
      return { title: `Crewspace — Directory, ${member.name} open` };
  }
  return { title: "Crewspace — Directory" };
}

/**
 * X-06 offline register row (SysReconnect.html): five columns — No.,
 * Person, Role, Teams, Status — with roles as plain text and people as
 * names only; rows are not links because membership actions are paused.
 * Zoe Adams' row is the pending one: sheet tint, seal "Waiting to save"
 * marker, role "Member · now Analyst", teams "Product" struck through
 * → "Partnerships".
 */
function OfflineDirectoryRow({ id }: { id: string }) {
  const member = getMember(id)!;
  const role = getRoles().find((r) => r.id === member.roleId)!;
  const pending = id === "036";
  const statusCell =
    member.status === "active" ? (
      <span role="cell" className="ok">
        Active
      </span>
    ) : (
      <span role="cell" className="off">
        Deactivated
      </span>
    );
  return (
    <div
      role="row"
      className="omr"
      style={pending ? { background: "var(--sheet-tint)" } : undefined}
    >
      <span role="cell" className="rg">
        {member.id}
      </span>
      <span role="cell">
        <b style={{ fontWeight: 600 }}>{member.name}</b>
        {pending ? (
          <>
            {" "}
            <span
              style={{
                fontSize: 12,
                color: "var(--seal)",
                fontWeight: 600,
                whiteSpace: "nowrap",
              }}
            >
              Waiting to save
            </span>
          </>
        ) : null}
      </span>
      {pending ? (
        <span role="cell">
          {role.name}{" "}
          <span style={{ color: "var(--muted)" }}>· now Analyst</span>
        </span>
      ) : (
        <span role="cell">{role.name}</span>
      )}
      {pending ? (
        <span role="cell">
          <s style={{ color: "var(--muted)" }}>Product</s> → Partnerships
        </span>
      ) : (
        <span role="cell">
          {member.teams.map((t) => getTeam(t.teamId)!.name).join(", ") ||
            "—"}
        </span>
      )}
      {statusCell}
    </div>
  );
}

function matchesQuery(entry: DirectoryEntry, q: string): boolean {
  const needle = q.toLowerCase();
  if (entry.kind === "member") {
    const m = entry.member;
    return `${m.name} ${m.email} ${m.id} Member ${m.id}`
      .toLowerCase()
      .includes(needle);
  }
  const i = entry.invitation;
  return `${i.name} ${i.email}`.toLowerCase().includes(needle);
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const offline = sp.state === "offline";
  const counts = directoryCounts();

  const q = (sp.q ?? "").trim();
  const status = ["active", "invited", "deactivated"].includes(sp.status ?? "")
    ? sp.status!
    : "all";

  /* ?role= / ?team= arrive as ids in the UI; a name typed by hand resolves
     to the same filter instead of silently matching nothing. */
  const roleParam = sp.role ?? "";
  const roleId =
    getRoles().find(
      (r) => r.id === roleParam || r.name.toLowerCase() === roleParam.toLowerCase(),
    )?.id ?? roleParam;
  const teamParam = sp.team ?? "";
  const teamId =
    getTeams().find(
      (t) => t.id === teamParam || t.name.toLowerCase() === teamParam.toLowerCase(),
    )?.id ?? teamParam;

  const hasFilter = q !== "" || status !== "all" || roleId !== "" || teamId !== "";
  const expanded = hasFilter || sp.show === "all";

  let entries: DirectoryEntry[];
  if (!expanded) {
    entries = getDirectorySpotlight();
  } else {
    entries = getDirectoryEntries()
      .slice()
      .sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "member" ? -1 : 1;
        if (a.kind === "member" && b.kind === "member")
          return a.member.id.localeCompare(b.member.id);
        return 0;
      })
      .filter((entry) => {
        if (q && !matchesQuery(entry, q)) return false;
        if (entry.kind === "member") {
          const m = entry.member;
          if (status === "active" && m.status !== "active") return false;
          if (status === "deactivated" && m.status !== "deactivated")
            return false;
          if (status === "invited") return false;
          if (roleId && m.roleId !== roleId) return false;
          if (teamId && !m.teams.some((t) => t.teamId === teamId))
            return false;
          return true;
        }
        const i = entry.invitation;
        if (status !== "all" && status !== "invited") return false;
        if (roleId && i.roleId !== roleId) return false;
        if (teamId && i.teamId !== teamId) return false;
        return true;
      });
  }

  const openMember = sp.open ? getMember(sp.open) : undefined;

  /* Row links keep the current filter/search state in the URL and add
     ?open=, so the list behind the drawer stays as the reader left it. */
  const rowHref = (id: string) => {
    const params = new URLSearchParams(serialize(sp));
    params.set("open", id);
    return `/app/people?${params.toString()}`;
  };

  const displayEntries = entries;

  const showMoreHref = (() => {
    const params = new URLSearchParams(serialize(sp));
    params.set("show", "all");
    return `/app/people?${params.toString()}`;
  })();

  return (
    <AppShell
      current="directory"
      banner={offline ? <ReconnectBanner pausedAt="10:41 AM" /> : undefined}
    >
      <div className="page-head" style={{ paddingTop: 22 }}>
        <div className="stack">
          <h1 className="title">Directory</h1>
          {offline ? (
            <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
              As of <span className="mono">10:41 AM</span>. Changes you make now
              wait until the connection is back.
            </span>
          ) : (
            <p className="lead">
              Everyone in Sevyn Labs, by register number. Open a person to see
              what they can do and why, without leaving the list.
            </p>
          )}
        </div>
        {/* X-06: the offline header is the title and the "As of" line
            only — SysReconnect.html draws no actions at all. */}
        {offline ? null : (
          <div className="head-actions">
            <ButtonLink href="/app/invitations/import">Import CSV</ButtonLink>
            <ButtonLink variant="pri" href="/app/invitations">
              Invite member
            </ButtonLink>
          </div>
        )}
      </div>

      {offline ? <ConflictSheet /> : null}

      <DirectoryFilters
        q={q}
        status={status}
        role={roleId}
        team={teamId}
        counts={counts}
        params={serialize(sp)}
      />

      {offline ? (
        /* X-06 (SysReconnect.html): the offline sheet is its own
           composition — the designed four-row register window on a
           700px five-column table, the paused-actions note, and no
           "Showing N of 45" counts footer. */
        <section
          className="sheet"
          style={{ overflow: "hidden", opacity: 0.94 }}
        >
          <div className="rows-scroll">
            <div
              role="table"
              aria-label="People, as of 10:41"
              style={{ minWidth: 700 }}
            >
              <div role="row" className="omr head">
                <span role="columnheader">No.</span>
                <span role="columnheader">Person</span>
                <span role="columnheader">Role</span>
                <span role="columnheader">Teams</span>
                <span role="columnheader">Status</span>
              </div>
              {getOfflineWindow().map((member) => (
                <OfflineDirectoryRow key={member.id} id={member.id} />
              ))}
            </div>
          </div>
          <p
            style={{
              margin: 0,
              padding: "12px 24px",
              borderTop: "1px solid var(--rule-strong)",
              fontSize: 12,
              color: "var(--muted)",
            }}
          >
            Role changes, deactivation and invitations are paused while
            offline. Reading and searching still work.
          </p>
        </section>
      ) : (
        <section className="sheet" style={{ overflow: "hidden" }}>
          <div className="rows-scroll">
            <div role="table" aria-label="People" style={{ minWidth: 860 }}>
              <div role="row" className="mr head">
                <span role="columnheader">No.</span>
                <span role="columnheader">Person</span>
                <span role="columnheader">Role</span>
                <span role="columnheader">Teams</span>
                <span role="columnheader">Status</span>
                <span role="columnheader">Last active</span>
              </div>
            {displayEntries.map((entry) =>
              entry.kind === "member" ? (
                <MemberRow
                  key={entry.member.id}
                  member={entry.member}
                  href={rowHref(entry.member.id)}
                  highlighted={
                    openMember?.id === entry.member.id ||
                    entry.member.id === "042"
                  }
                  you={entry.member.id === "001"}
                />
              ) : (
                <InvitationRow
                  key={entry.invitation.id}
                  invitation={entry.invitation}
                />
              ),
            )}
            {displayEntries.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  padding: "18px 24px",
                  borderTop: "1px solid var(--rule)",
                  fontSize: 14,
                  color: "var(--muted)",
                }}
              >
                No one matches those filters.
              </p>
            ) : null}
          </div>
        </div>
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--rule-strong)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            gap: 10,
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          <span>
            Showing {displayEntries.length} of {counts.all} · {counts.active}{" "}
            active, {counts.deactivated} deactivated, {counts.invited} invited
          </span>
          {!expanded ? (
            <Link href={showMoreHref}>
              Show {counts.all - displayEntries.length} more
            </Link>
          ) : null}
        </div>
        </section>
      )}

      {openMember ? (
        <DirectoryDrawer
          member={openMember}
          offline={offline}
          returnQuery={serialize(sp, "open")}
          lastActiveText={
            openMember.id === "042"
              ? "Today, 9:12 AM · 2 sessions"
              : undefined
          }
        />
      ) : null}
    </AppShell>
  );
}
