import Link from "next/link";
import type { Metadata } from "next";
import {
  directoryCounts,
  getDirectoryEntries,
  getMember,
  getRoles,
  getTeams,
  type DirectoryEntry,
  type WorkspaceData,
} from "@/lib/api";
import {
  getActiveWorkspace,
  getMyPermissionKeys,
  loadActiveWorkspaceData,
} from "@/lib/data/server";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { InvitationRow, MemberRow } from "@/components/MemberRow";
import { DirectoryDrawer } from "./DirectoryDrawer";
import { DirectoryFilters } from "./DirectoryFilters";

/**
 * P-02 Directory (+ P-03 drawer via ?open=).
 * All rows come from the signed-in user's workspace (RLS-scoped).
 * Default: the first page of entries in register order; any
 * filter/search — or "Show N more" (?show=all) — runs over all
 * entries. Filters are query params evaluated against the real data.
 * (The old ?state=offline fixture window is gone: there is no
 * persona/offline fabrication in production.)
 */

const PAGE_SIZE = 12;

type SearchParams = {
  q?: string;
  status?: string;
  role?: string;
  team?: string;
  open?: string;
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
  if (sp.open) {
    const data = await loadActiveWorkspaceData();
    const member = data ? getMember(data, sp.open) : undefined;
    if (member)
      return { title: `Crewspace — Directory, ${member.name} open` };
  }
  return { title: "Crewspace — Directory" };
}

function matchesQuery(entry: DirectoryEntry, q: string): boolean {
  const needle = q.toLowerCase();
  if (entry.kind === "member") {
    const m = entry.member;
    return `${m.name} ${m.email} ${m.id}`.toLowerCase().includes(needle);
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
  const data: WorkspaceData | null = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="directory">{null}</AppShell>;
  }
  const ws = await getActiveWorkspace();
  const myKeys = ws ? await getMyPermissionKeys(ws.orgId) : [];
  const canDeactivate = myKeys.includes("members:deactivate");
  const counts = directoryCounts(data);

  const q = (sp.q ?? "").trim();
  const status = ["active", "invited", "deactivated"].includes(sp.status ?? "")
    ? sp.status!
    : "all";

  /* ?role= / ?team= arrive as ids; a name typed by hand resolves to
     the same filter instead of silently matching nothing. */
  const roleParam = sp.role ?? "";
  const roleId =
    getRoles(data).find(
      (r) => r.id === roleParam || r.name.toLowerCase() === roleParam.toLowerCase(),
    )?.id ?? roleParam;
  const teamParam = sp.team ?? "";
  const teamId =
    getTeams(data).find(
      (t) => t.id === teamParam || t.name.toLowerCase() === teamParam.toLowerCase(),
    )?.id ?? teamParam;

  const hasFilter = q !== "" || status !== "all" || roleId !== "" || teamId !== "";
  const expanded = hasFilter || sp.show === "all";

  const all = getDirectoryEntries(data);
  const filtered = all.filter((entry) => {
    if (q && !matchesQuery(entry, q)) return false;
    if (entry.kind === "member") {
      const m = entry.member;
      if (status === "active" && m.status !== "active") return false;
      if (status === "deactivated" && m.status !== "deactivated") return false;
      if (status === "invited") return false;
      if (roleId && m.roleId !== roleId) return false;
      if (teamId && !m.teams.some((t) => t.teamId === teamId)) return false;
      return true;
    }
    const i = entry.invitation;
    if (status !== "all" && status !== "invited") return false;
    if (roleId && i.roleId !== roleId) return false;
    if (teamId && i.teamId !== teamId) return false;
    return true;
  });
  const entries = expanded ? filtered : filtered.slice(0, PAGE_SIZE);

  const openMember = sp.open ? getMember(data, sp.open) : undefined;

  /* Row links keep the current filter/search state in the URL and add
     ?open=, so the list behind the drawer stays as the reader left it. */
  const rowHref = (id: string) => {
    const params = new URLSearchParams(serialize(sp));
    params.set("open", id);
    return `/app/people?${params.toString()}`;
  };

  const showMoreHref = (() => {
    const params = new URLSearchParams(serialize(sp));
    params.set("show", "all");
    return `/app/people?${params.toString()}`;
  })();

  const headBlock = (
    <div className="page-head" style={{ paddingTop: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h1 className="p-title">Directory</h1>
        <p className="p-lede">
          Everyone in {data.org.name}, by register order. Open a person to
          see what they can do and why, without leaving the list.
        </p>
      </div>
      <div className="head-actions">
        <ButtonLink href="/app/invitations/import">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M8 10.5V2.5M4.8 5.5 8 2.3l3.2 3.2" />
            <path d="M2.5 10.5v2.5h11v-2.5" />
          </svg>
          Import CSV
        </ButtonLink>
        <ButtonLink variant="pri" href="/app/invitations">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <path d="M8 3v10M3 8h10" />
          </svg>
          Invite member
        </ButtonLink>
      </div>
    </div>
  );

  return (
    <AppShell current="directory">
      {headBlock}
      <section className="card p-dir" style={{ overflow: "hidden" }}>
        <DirectoryFilters
          q={q}
          status={status}
          role={roleId}
          team={teamId}
          counts={counts}
          params={serialize(sp)}
          roles={getRoles(data).map((r) => ({ id: r.id, name: r.name }))}
          teams={getTeams(data).map((t) => ({ id: t.id, name: t.name }))}
        />
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
            {entries.map((entry) =>
              entry.kind === "member" ? (
                <MemberRow
                  key={entry.member.id}
                  member={entry.member}
                  roles={data.org.roles}
                  teams={data.teams}
                  href={rowHref(entry.member.id)}
                  highlighted={openMember?.id === entry.member.id}
                  you={entry.member.id === ws?.membershipId}
                />
              ) : (
                <InvitationRow
                  key={entry.invitation.id}
                  invitation={entry.invitation}
                  roles={data.org.roles}
                  teams={data.teams}
                />
              ),
            )}
            {entries.length === 0 ? (
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
        <div className="p-dirfoot">
          <span>
            Showing {entries.length} of {counts.all} · {counts.active}{" "}
            active, {counts.deactivated} deactivated, {counts.invited} invited
          </span>
          {!expanded && filtered.length > entries.length ? (
            <Link href={showMoreHref}>
              Show {filtered.length - entries.length} more
            </Link>
          ) : null}
        </div>
      </section>

      {openMember ? (
        <DirectoryDrawer
          member={openMember}
          data={data}
          canDeactivate={canDeactivate}
          returnQuery={serialize(sp, "open")}
        />
      ) : null}
    </AppShell>
  );
}
