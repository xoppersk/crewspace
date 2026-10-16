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
import { IconEnvelope, IconShieldCheck } from "@/components/icons";

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

/* Roles whose "Who has what" bar the screen draws grey instead of seal. */
const GREY_BAR_ROLES = new Set(["member", "guest"]);

/* Avatar tints the Overview screen draws for the three invitees
   (screen-literal; the shared per-person map lives in MemberRow). */
const INVITEE_TINTS: Record<string, string> = {
  "inv-priya": "#E9E3D6",
  "inv-noah": "#DDEBE2",
  "inv-leah": "#F0DDDA",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function IconKey() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="5.5" cy="10.5" r="2.8" />
      <path d="m7.5 8.5 6-6M11.5 4.5l1.8 1.8" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.8V8l2.2 1.6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 3v10M3 8h10" />
    </svg>
  );
}

const NEED_ICONS: Record<string, { cls: string; icon: ReactNode }> = {
  "role-review": { cls: "is-seal", icon: <IconShieldCheck /> },
  "leah-invite": { cls: "is-deny", icon: <IconEnvelope /> },
  "two-step": { cls: "is-pend", icon: <IconKey /> },
  "priya-expiring": { cls: "is-flat", icon: <IconClock /> },
};

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
  const maxRoleCount = Math.max(
    ...ROLE_ORDER.map((id) => roleMemberCount(id)),
  );

  return (
    <AppShell current="overview">
      <div className="page-head" style={{ paddingTop: 26 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            {org.today}
          </span>
          <h1 className="p-title">Overview</h1>
          <p className="p-lede">
            {getMembers().length} members across {getTeams().length} teams
            and {getRoles().length} roles. {open.length} invitations are
            open, one role has changes waiting for your review, and{" "}
            {needs.length} things need an owner today.
          </p>
        </div>
        <ButtonLink variant="pri" href="/app/people">
          <IconPlus />
          Invite member
        </ButtonLink>
      </div>

      <div className="p-cols">
        <div className="p-stack">
          <section className="card" aria-labelledby="no" style={{ overflow: "hidden" }}>
            <div className="p-ch">
              <h2 id="no" className="p-h2">
                Needs an owner
              </h2>
              <span className="p-sub">Most consequential first</span>
            </div>
            {needs.map((item, i) => {
              const copy = needsCopy[item.id] ?? {
                title: item.title,
                detail: item.detail,
                action: item.action,
              };
              const icon = NEED_ICONS[item.id] ?? {
                cls: "is-flat",
                icon: <IconClock />,
              };
              return (
                <div
                  key={item.id}
                  className={i === 0 ? "p-need first" : "p-need"}
                >
                  <span className={`p-ico ${icon.cls}`} aria-hidden="true">
                    {icon.icon}
                  </span>
                  <span>
                    <b>{copy.title}</b>
                    <small>{copy.detail}</small>
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

          <section className="card" aria-labelledby="rc">
            <div className="p-ch tight">
              <h2 id="rc" className="p-h2">
                Recent access changes
              </h2>
              <Link href="/app/audit" style={{ fontSize: 13, fontWeight: 600 }}>
                Open audit log
              </Link>
            </div>
            <div
              style={{
                padding: "16px 22px 20px",
                borderTop: "1px solid var(--rule)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              {recent.map((row, i) => {
                const last = i === recent.length - 1;
                return (
                  <div key={row.day} className={last ? "p-tl last" : "p-tl"}>
                    <span className="when mono">{row.day}</span>
                    <span className="rail" aria-hidden="true">
                      <i className={i === 0 ? "dotty" : "dotty grey"} />
                      {last ? null : <i className="line" />}
                    </span>
                    <span className="body">{row.body}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <aside className="p-aside">
          <section
            className="card"
            aria-labelledby="hc"
            style={{ padding: "18px 18px 16px" }}
          >
            <h2 id="hc" className="p-panel" style={{ marginBottom: 8 }}>
              Who has what
            </h2>
            <div>
              {ROLE_ORDER.map((id) => {
                const role = getRole(id)!;
                const count = roleMemberCount(id);
                return (
                  <div className="p-whw" key={id}>
                    {id === "product-admin" ? (
                      <Link href="/app/roles/product-admin">{role.name}</Link>
                    ) : (
                      <span>{role.name}</span>
                    )}
                    <span className="track" aria-hidden="true">
                      <i
                        className={GREY_BAR_ROLES.has(id) ? "grey" : undefined}
                        style={{
                          width: `${Math.max(5, Math.round((count / maxRoleCount) * 100))}%`,
                        }}
                      />
                    </span>
                    <span className="mono n">{count}</span>
                  </div>
                );
              })}
            </div>
            <p
              style={{
                margin: "10px 0 0",
                paddingTop: 12,
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

          <section
            className="card"
            aria-labelledby="iv"
            style={{ padding: "18px 18px 8px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <h2 id="iv" className="p-panel">
                Open invitations · {open.length}
              </h2>
              <Link href="/app/invitations" style={{ fontSize: 13, fontWeight: 600 }}>
                All
              </Link>
            </div>
            <div>
              {open.map((inv) => {
                const role = getRole(inv.roleId)!;
                return (
                  <div className="p-inv-row" key={inv.id}>
                    <span className="p-pm">
                      <span
                        className="p-avr sm"
                        aria-hidden="true"
                        style={{ background: INVITEE_TINTS[inv.id] ?? "var(--fill)" }}
                      >
                        {initialsOf(inv.name)}
                      </span>
                      <span>
                        {inv.name} · {role.name}
                      </span>
                    </span>
                    {inv.status === "bounced" ? (
                      <span className="p-st is-bad">didn’t arrive</span>
                    ) : inv.openedAt ? (
                      <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                        opened {inv.openedAt}
                      </span>
                    ) : (
                      <span className="p-st is-pe">expires {inv.expires}</span>
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
