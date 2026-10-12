import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInvitations,
  getMember,
  getRole,
  getTeam,
  roleAllows,
  teamMembers,
  teamRoleMix,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import { RoleTag } from "@/components/RoleTag";
import { EmptyTeamState } from "@/components/States";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { state } = await searchParams;
  if (state === "empty" || id === "partnerships") {
    return { title: "Crewspace — Empty team" };
  }
  const team = getTeam(id);
  return {
    title: team ? `Crewspace — ${team.name} team` : "Crewspace — Teams",
  };
}

export default async function TeamDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { id } = await params;
  const { state } = await searchParams;

  /* X-02: a brand-new, empty team. */
  if (state === "empty" || id === "partnerships") {
    return (
      <AppShell current="teams">
        <EmptyTeamState />
      </AppShell>
    );
  }

  const team = getTeam(id);
  if (!team || team.unlisted) notFound();
  const lead = team.leadId ? getMember(team.leadId) : undefined;
  const rows = teamMembers(id)
    .filter((m) => m.status === "active")
    .sort((a, b) => {
      const byRole =
        roleAllows(getRole(b.roleId)!) - roleAllows(getRole(a.roleId)!);
      return byRole !== 0 ? byRole : a.id.localeCompare(b.id);
    });
  // Designed TeamDetail shows only the open invitation (Priya). A bounced
  // invitation never arrived, so it gets no invited row on the team.
  const invited = getInvitations().filter(
    (i) => i.teamId === id && i.status === "open",
  );
  const mix = teamRoleMix(id)
    .filter((x) =>
      teamMembers(id).some(
        (m) => m.roleId === x.role.id && m.status === "active",
      ),
    )
    .sort((a, b) => roleAllows(b.role) - roleAllows(a.role));
  const recent =
    id === "product"
      ? [
          { when: "Oct 5", text: "Maya Jordan joined as Product admin" },
          { when: "Oct 4", text: "Priya Shah invited as Analyst by Daniel Okafor" },
          { when: "Sep 2", text: "Yusuf Ali added" },
        ]
      : [{ when: "—", text: `Last change recorded in the audit log` }];

  return (
    <AppShell current="teams">
      <div className="crumb">
        <Link href="/app/teams">Teams</Link> / {team.name}
      </div>
      <div className="cols">
        <div
          className="main-sheet"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <header
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <h1 className="title">{team.name}</h1>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Team <span className="mono">{team.regNumber}</span> ·{" "}
                {team.blurb}
                {lead ? ` · led by ${lead.name}` : " · no lead yet"}
              </span>
            </div>
            <div className="head-actions">
              <ButtonLink href="#">Team settings</ButtonLink>
              <ButtonLink variant="pri" href="/app/invitations">
                Add people
              </ButtonLink>
            </div>
          </header>

          <section className="sheet">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                padding: "14px 24px",
              }}
            >
              <h2 className="section">Members · {rows.length}</h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Sorted by role, then register number
              </span>
            </div>
            <div className="rows-scroll">
              <div
                role="table"
                aria-label={`${team.name} team members`}
                style={{ minWidth: 760 }}
              >
                <div role="row" className="tmr head">
                  <span role="columnheader">No.</span>
                  <span role="columnheader">Person</span>
                  <span role="columnheader">Role</span>
                  <span role="columnheader">Also on</span>
                  <span role="columnheader">Joined</span>
                  <span role="columnheader">
                    <span className="sr-only">Actions</span>
                  </span>
                </div>
                {rows.map((m) => {
                  const role = getRole(m.roleId)!;
                  const alsoOn = m.teams.filter((t) => t.teamId !== id);
                  const isLead = m.teams.find((t) => t.teamId === id)?.lead;
                  return (
                    <div role="row" className="tmr" key={m.id}
                      style={m.isNew ? { background: "var(--sheet-tint)" } : undefined}
                    >
                      <span role="cell" className="rg">{m.id}</span>
                      <span role="cell">
                        <b style={{ fontWeight: 600 }}>{m.name}</b>{" "}
                        {isLead ? <span className="newmark">Lead</span> : null}
                        {m.isNew ? <span className="newmark">New</span> : null}
                        <small>{m.email}</small>
                      </span>
                      <span role="cell">
                        {/* TeamDetail.html: only the Product admin tag
                            is a link; every other role tag is a span. */}
                        <RoleTag
                          role={role}
                          link={role.id === "product-admin"}
                        />
                      </span>
                      <span role="cell" style={{ color: alsoOn.length ? "var(--ink-2)" : "var(--muted)" }}>
                        {alsoOn.length
                          ? alsoOn.map((t) => getTeam(t.teamId)?.name).join(", ")
                          : "—"}
                      </span>
                      <span role="cell" style={{ color: "var(--ink-2)" }}>
                        {m.joined}
                      </span>
                      <span role="cell">
                        <button type="button" className="mx" aria-label={`More for ${m.name}`}>
                          ⋯
                        </button>
                      </span>
                    </div>
                  );
                })}
                {invited.map((inv) => {
                  const role = getRole(inv.roleId)!;
                  const inviter = getMember(inv.invitedById);
                  return (
                    <div
                      role="row"
                      className="tmr"
                      key={inv.id}
                      style={{ background: "var(--sheet-sunk)" }}
                    >
                      <span role="cell" className="rg">—</span>
                      <span role="cell">
                        <b style={{ fontWeight: 600, color: "var(--ink-2)" }}>
                          {inv.name}
                        </b>
                        <small>
                          {inv.email} · invited {inv.sent} by {inviter?.name}
                        </small>
                      </span>
                      <span role="cell">
                        <span className="ro dashed plain">{role.name}</span>
                      </span>
                      <span role="cell" className="pe big">
                        Invited · expires {inv.expires}
                      </span>
                      <span role="cell">
                        <a href="/app/invitations" style={{ fontSize: 13 }}>
                          Resend
                        </a>
                      </span>
                      <span role="cell" />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        </div>

        <aside className="side-col">
          <section className="sheet panel-box" aria-labelledby="acc">
            <h2 id="acc" className="panel">
              Where this team’s access comes from
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              Being on {team.name} grants nothing by itself. Each person’s
              role decides what they can do anywhere in Sevyn Labs.
            </p>
            <div>
              {mix.map(({ role, count }) => (
                <div className="ll" key={role.id}>
                  {/* Access panel: only Product admin is a link
                      (TeamDetail.html); the rest are plain names. */}
                  {role.id === "product-admin" ? (
                    <Link href={`/app/roles/${role.id}`}>{role.name}</Link>
                  ) : (
                    <span>{role.name}</span>
                  )}
                  <i />
                  <span className="mono">{count}</span>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>
                    allows {roleAllows(role)} of 18
                  </span>
                </div>
              ))}
            </div>
            <p
              style={{
                margin: 0,
                paddingTop: 10,
                borderTop: "1px solid var(--rule)",
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              Removing someone from this team leaves their role and access
              unchanged. To change what they can do,{" "}
              <Link href="/app/roles">change their role</Link>.
            </p>
          </section>

          {lead ? (
            <section className="sheet panel-box" aria-labelledby="leadp">
              <h2 id="leadp" className="panel">
                What the lead does
              </h2>
              <span
                style={{ fontSize: 13, lineHeight: 1.5, color: "var(--ink-2)" }}
              >
                {lead.name.split(" ")[0]} gets a copy of every invitation to
                this team and is asked first when someone requests a role
                change here. Leading a team is not a permission.
              </span>
            </section>
          ) : null}

          <section
            aria-labelledby="ch"
            style={{
              padding: "4px 4px 0",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <h2
              id="ch"
              style={{
                margin: 0,
                font: "600 13px/1.3 var(--font-sans)",
                color: "var(--muted)",
              }}
            >
              Recent changes
            </h2>
            {recent.map((r, i) => (
              <span key={i}>
                <span className="mono" style={{ fontSize: 12, color: "var(--muted)" }}>
                  {r.when}
                </span>{" "}
                · {r.text}
              </span>
            ))}
            <a href="/app/audit">Open in audit log</a>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
