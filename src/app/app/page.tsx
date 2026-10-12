import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  deactivateScopeCount,
  getInvitations,
  getMember,
  getMembers,
  getNeedsOwner,
  getOrg,
  getRole,
  getRoles,
  getTeams,
  openInvitations,
  roleMemberCount,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";

export const metadata: Metadata = { title: "Crewspace — Overview" };

/* P-01 Overview — screens/Overview.html.
   Needs-owner titles/details/actions below are the screen's exact copy;
   the overview.json fixture strings differ (reported as a fixture gap),
   so the copy is keyed by item id while counts come from the API. */

const ROLE_ORDER = [
  "owner",
  "product-admin",
  "support-lead",
  "billing-admin",
  "analyst",
  "auditor",
  "finance-viewer",
  "member",
  "guest",
];

export default function OverviewPage() {
  const org = getOrg();
  const needs = getNeedsOwner();
  const open = openInvitations();
  const invitations = getInvitations();

  const productAdmin = getRole("product-admin")!;
  const pendingCount = productAdmin.pendingChanges?.length ?? 0;
  const paMembers = roleMemberCount("product-admin");
  const noTwoStep = getMembers().filter((m) => m.twoStep === false);
  const leah = invitations.find((i) => i.id === "inv-leah")!;
  const leahInviter = getMember(leah.invitedById);
  const priya = invitations.find((i) => i.id === "inv-priya")!;
  const priyaRole = getRole(priya.roleId)!;
  const priyaTeam = getTeams().find((t) => t.id === priya.teamId);

  const needsCopy: Record<
    string,
    { title: string; detail: string; action: string; pri?: boolean }
  > = {
    "role-review": {
      title: `${productAdmin.name} has ${pendingCount} changes waiting for review`,
      detail: `If applied, ${paMembers} people can deactivate ${deactivateScopeCount()} members. Only you can apply it.`,
      action: "Review changes",
      pri: true,
    },
    "leah-invite": {
      title: "Leah Kim’s invitation didn’t arrive",
      detail: `leah.kim@sevynlabs.io bounced on Oct 4. She was invited as Product admin by ${leahInviter?.name ?? "Daniel Okafor"}.`,
      action: "Fix the address",
    },
    "two-step": {
      title: `${noTwoStep.length} people still sign in without 2-step verification`,
      detail: `Sam Patel, Iris Novak (Guest) and Yusuf Ali. Your setting makes it required from Nov 1.`,
      action: "Remind them",
    },
    "priya-expiring": {
      title: "Priya Shah’s invitation expires in 5 days",
      detail: `${priyaRole.name} on ${priyaTeam?.name ?? "Product"}. Sent ${priya.sent}, not opened yet.`,
      action: "Resend",
    },
  };

  /* The screen's exact recent-changes prose. The audit fixture carries
     different summaries and has no entries for several of these rows
     (reported as a fixture gap), so the rows are the screen copy. */
  const recent: { day: string; body: ReactNode }[] = [
    {
      day: "Oct 5",
      body: (
        <>
          <b style={{ fontWeight: 600 }}>Maya Jordan</b> accepted her
          invitation and became Member <span className="mono">042</span>,
          Product admin, on Product.
        </>
      ),
    },
    {
      day: "Oct 4",
      body: (
        <>
          <b style={{ fontWeight: 600 }}>Daniel Okafor</b> invited Priya Shah
          as Analyst and Leah Kim as Product admin.
        </>
      ),
    },
    {
      day: "Oct 3",
      body: (
        <>
          <b style={{ fontWeight: 600 }}>You</b> invited Maya Jordan as
          Product admin.
        </>
      ),
    },
    {
      day: "Oct 2",
      body: (
        <>
          <b style={{ fontWeight: 600 }}>You</b> changed Product admin:
          Create teams, Inherit → Allow. Affected 4 people.
        </>
      ),
    },
    {
      day: "Sep 30",
      body: (
        <>
          <b style={{ fontWeight: 600 }}>Owen Clarke</b> signed Felix Grant
          out of all sessions after a lost laptop.
        </>
      ),
    },
  ];

  const canChangeAccess =
    roleMemberCount("owner") +
    roleMemberCount("product-admin") +
    roleMemberCount("support-lead");

  return (
    <AppShell current="overview">
      <div className="page-head" style={{ paddingTop: 22 }}>
        <div className="stack">
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {org.today}
          </span>
          <h1 className="title">Overview</h1>
          <p className="lead" style={{ maxWidth: "50em" }}>
            {getMembers().length} members across {getTeams().length} teams
            and {getRoles().length} roles. {open.length} invitations are
            open, one role has changes waiting for your review, and{" "}
            {needs.length} things need an owner today.
          </p>
        </div>
        <ButtonLink variant="pri" href="/app/people">
          Invite member
        </ButtonLink>
      </div>

      <div className="cols">
        <div
          style={{
            flex: "999 1 620px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <section className="sheet" aria-labelledby="no">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                padding: "16px 24px 10px",
              }}
            >
              <h2 id="no" className="section">
                Needs an owner
              </h2>
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                Most consequential first
              </span>
            </div>
            {needs.map((item) => {
              const copy = needsCopy[item.id] ?? {
                title: item.title,
                detail: item.detail,
                action: item.action,
              };
              return (
                <div
                  key={item.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 16,
                    alignItems: "center",
                    padding: "14px 24px",
                    borderTop: "1px solid var(--rule)",
                  }}
                >
                  <span>
                    <b style={{ fontWeight: 600 }}>{copy.title}</b>
                    <small
                      style={{
                        display: "block",
                        fontSize: 13,
                        color: "var(--ink-2)",
                        marginTop: 3,
                        lineHeight: 1.45,
                      }}
                    >
                      {copy.detail}
                    </small>
                  </span>
                  <ButtonLink
                    variant={copy.pri ? "pri" : "outline"}
                    href={item.href}
                  >
                    {copy.action}
                  </ButtonLink>
                </div>
              );
            })}
          </section>

          <section className="sheet" aria-labelledby="rc">
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: 8,
                padding: "16px 24px 10px",
              }}
            >
              <h2 id="rc" className="section">
                Recent access changes
              </h2>
              <Link href="/app/audit" style={{ fontSize: 13 }}>
                Open audit log
              </Link>
            </div>
            {recent.map((row, i) => (
              <div
                key={row.day}
                style={{
                  display: "grid",
                  gridTemplateColumns: "56px minmax(0, 1fr)",
                  gap: 12,
                  padding:
                    i === recent.length - 1
                      ? "10px 24px 14px"
                      : "10px 24px",
                  borderTop: "1px solid var(--rule)",
                  fontSize: 13,
                  lineHeight: 1.5,
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: 12, color: "var(--muted)" }}
                >
                  {row.day}
                </span>
                <span>{row.body}</span>
              </div>
            ))}
          </section>
        </div>

        <aside className="side-col">
          <section className="sheet panel-box" aria-labelledby="hc">
            <h2 id="hc" className="panel">
              Who has what
            </h2>
            <div>
              {ROLE_ORDER.map((id) => {
                const role = getRole(id)!;
                return (
                  <div className="ll" key={id}>
                    {id === "product-admin" ? (
                      <Link href="/app/roles/product-admin">{role.name}</Link>
                    ) : (
                      <span>{role.name}</span>
                    )}
                    <i />
                    <span className="mono">{roleMemberCount(id)}</span>
                  </div>
                );
              })}
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
              {canChangeAccess} people can change someone else’s access: you,{" "}
              {roleMemberCount("product-admin")} Product admins and{" "}
              {roleMemberCount("support-lead")} Support leads. The draft
              Weekend support role would add 2.
            </p>
          </section>

          <section className="sheet panel-box" aria-labelledby="iv">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
              }}
            >
              <h2 id="iv" className="panel">
                Open invitations · {open.length}
              </h2>
              <Link href="/app/invitations" style={{ fontSize: 13 }}>
                All
              </Link>
            </div>
            <div>
              {open.map((inv) => {
                const role = getRole(inv.roleId)!;
                return (
                  <div className="ll" key={inv.id}>
                    <span>
                      {inv.name} · {role.name}
                    </span>
                    <i />
                    {inv.status === "bounced" ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--deny)",
                        }}
                      >
                        didn’t arrive
                      </span>
                    ) : inv.openedAt ? (
                      <span style={{ fontSize: 12, color: "var(--ink-2)" }}>
                        opened {inv.openedAt}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--pending)",
                        }}
                      >
                        expires {inv.expires}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
