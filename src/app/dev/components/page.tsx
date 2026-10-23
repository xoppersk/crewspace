"use client";

/**
 * /dev/components — the 12 design-system components, rendered from
 * sample data constructed in this file. A build tool, not a designed
 * screen and not connected to any workspace: clean, labelled,
 * token-only. (It used to read the fixture API; production code no
 * longer imports fixtures, so the samples live here.)
 */
import { useState, type ReactNode } from "react";
import { PERMISSION_GROUPS } from "@/lib/data/permissions";
import type { WorkspaceData } from "@/lib/api";
import type {
  Invitation,
  Member,
  Permission,
  Role,
  Setting,
  Team,
} from "@/lib/types";
import { Button, ButtonLink } from "@/components/Button";
import { LegalFooter } from "@/components/LegalFooter";
import { InvitationRow, MemberRow } from "@/components/MemberRow";
import { MemberDrawer } from "@/components/MemberDrawer";
import { PermissionRow } from "@/components/PermissionRow";
import { PermissionStrip } from "@/components/PermissionStrip";
import { ReconnectBanner } from "@/components/ReconnectBanner";
import { ReviewBar } from "@/components/ReviewBar";
import { RoleTag } from "@/components/RoleTag";
import { SideNav } from "@/components/SideNav";
import { StateNotice } from "@/components/StateNotice";
import { WizardSteps } from "@/components/WizardSteps";

function Section({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-label={name}
    >
      <h2
        className="mono"
        style={{
          margin: 0,
          font: "500 12px/1 var(--font-mono)",
          color: "var(--muted)",
        }}
      >
        {name}
      </h2>
      {children}
    </section>
  );
}

/* ---- sample data (this file only) ---- */
const SAMPLE_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissionIds.map((id) => ({
    id,
    group: g.name,
    name: `Permission ${id}`,
    description: `Sample description for permission ${id}.`,
  })),
);
function sampleRole(
  id: string,
  name: string,
  allows: number[],
  denies: number[] = [],
): Role {
  return {
    id,
    regNumber: "R-00",
    name,
    type: "Custom",
    summary: "",
    settings: Object.fromEntries(
      SAMPLE_PERMISSIONS.map((p) => [
        String(p.id),
        allows.includes(p.id)
          ? "allow"
          : denies.includes(p.id)
            ? "deny"
            : "inherit",
      ]),
    ) as Record<string, Setting>,
    lastChanged: "",
  };
}
const productAdmin = sampleRole(
  "product-admin",
  "Product admin",
  [1, 3, 4, 5, 7, 9, 10, 11, 13, 14],
  [8, 16, 18],
);
const supportLead = sampleRole("support-lead", "Support lead", [1, 3, 10, 14]);
const analyst = sampleRole("analyst", "Analyst", [3, 7, 15]);
const memberRole = sampleRole("member", "Member", [3]);
const SAMPLE_ROLES = [productAdmin, supportLead, analyst, memberRole];
const SAMPLE_TEAMS: Team[] = [
  { id: "product", regNumber: "T-01", name: "Product", blurb: "", leadId: "m-maya" },
];
const maya: Member = {
  id: "m-maya",
  name: "Maya Jordan",
  email: "maya.jordan@example.com",
  roleId: "product-admin",
  status: "active",
  teams: [{ teamId: "product", lead: true }],
  joined: "Aug 2026",
  lastActive: "Now",
};
const priya: Invitation = {
  id: "inv-priya",
  name: "Priya Shah",
  email: "priya.shah@example.com",
  roleId: "analyst",
  teamId: "product",
  invitedById: "m-maya",
  sent: "Oct 5",
  status: "open",
  openedAt: null,
  expires: "Oct 12",
};
const SAMPLE_DATA: WorkspaceData = {
  org: {
    name: "Example Org",
    domain: "example.com",
    domainVerified: "",
    today: "",
    todayFull: "",
    plan: {
      name: "",
      seats: 2,
      pricePerSeat: 8,
      renews: "",
      nextInvoice: "",
      billingContactId: "",
    },
    baseline: { allowedPermissionIds: [3] },
    groups: PERMISSION_GROUPS,
    permissions: SAMPLE_PERMISSIONS,
    roles: SAMPLE_ROLES,
  },
  members: [maya],
  teams: SAMPLE_TEAMS,
  invitations: [priya],
  auditEntries: [],
  needsOwner: [],
};
const perm = (id: number) => SAMPLE_PERMISSIONS.find((p) => p.id === id)!;

export default function ComponentsPage() {

  const [reviewCount, setReviewCount] = useState(2);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div style={{ background: "var(--ground)", minHeight: "100vh" }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "40px 24px 64px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <header>
          <h1 className="title">Crewspace design system</h1>
          <p className="lead" style={{ marginTop: 6 }}>
            The 12 components, live from sample data defined in this file.
          </p>
        </header>

        <Section name="Button">
          <div
            className="sheet"
            style={{
              padding: 20,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <Button variant="pri">Review changes</Button>
            <Button>Duplicate</Button>
            <ButtonLink href="#">Role history</ButtonLink>
            <Button variant="dest">Deactivate member</Button>
            <Button disabled>Disabled</Button>
            <Button size="h40">Wizard height · 40</Button>
            <Button size="h44">Auth height · 44</Button>
          </div>
        </Section>

        <Section name="PermissionRow">
          <div className="sheet" role="table" aria-label="Permission rows">
            <PermissionRow
              permission={perm(1)}
              baselineIds={[3]}
              setting={productAdmin.settings["1"]!}
            />
            <PermissionRow
              permission={perm(14)}
              baselineIds={[3]}
              setting={productAdmin.settings["14"]!}
            />
            <PermissionRow
              permission={perm(2)}
              baselineIds={[3]}
              setting="allow"
              changedFrom="deny"
              resultNote="36 people in scope"
            />
            <PermissionRow
              permission={perm(18)}
              baselineIds={[3]}
              setting={productAdmin.settings["18"]!}
            />
          </div>
        </Section>

        <Section name="PermissionStrip">
          <div
            className="sheet"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {[
              { role: productAdmin, label: "Product admin" },
              { role: supportLead, label: "Support lead" },
              { role: analyst, label: "Analyst" },
            ].map((x) => (
              <div
                key={x.role.id}
                style={{ display: "flex", alignItems: "center", gap: 14 }}
              >
                <span style={{ width: 120, fontSize: 13 }}>{x.label}</span>
                <PermissionStrip role={x.role} permissions={SAMPLE_PERMISSIONS} baselineIds={[3]} />
              </div>
            ))}
            <div style={{ marginTop: 6 }}>
              <PermissionStrip role={productAdmin} permissions={SAMPLE_PERMISSIONS} baselineIds={[3]} full />
            </div>
          </div>
        </Section>

        <Section name="RoleTag">
          <div
            className="sheet"
            style={{
              padding: 20,
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <RoleTag role={productAdmin} />
            <RoleTag role={analyst} />
            <RoleTag role={memberRole} />
            <RoleTag role={analyst} dashed />
            <span className="ok">Active</span>
            <span className="pe">Invited · expires Oct 11</span>
          </div>
        </Section>

        <Section name="MemberRow">
          <div className="sheet" role="table" aria-label="Member rows">
            <MemberRow member={maya} roles={SAMPLE_ROLES} teams={SAMPLE_TEAMS} />
            <InvitationRow invitation={priya} roles={SAMPLE_ROLES} teams={SAMPLE_TEAMS} />
          </div>
        </Section>

        <Section name="ReviewBar">
          <div className="sheet" style={{ overflow: "hidden" }}>
            <p style={{ margin: 0, padding: "16px 24px", fontSize: 13 }}>
              {reviewCount === 0
                ? "Changes discarded — the bar hides itself at zero."
                : "Sticky bar at the bottom of the register sheet while changes are pending."}
            </p>
            <ReviewBar
              count={reviewCount}
              affects="affects 5 members"
              onDiscard={() => setReviewCount(0)}
              onReview={() => setReviewCount(2)}
            />
          </div>
          {reviewCount === 0 ? (
            <div>
              <Button onClick={() => setReviewCount(2)}>
                Restore 2 changes
              </Button>
            </div>
          ) : null}
        </Section>

        <Section name="SideNav">
          <div
            style={{
              border: "1px solid var(--frame)",
              borderRadius: "var(--radius-l)",
              overflow: "hidden",
            }}
          >
            <SideNav current="roles" data={SAMPLE_DATA} me={maya} />
          </div>
        </Section>

        <Section name="Drawer">
          <div
            className="sheet"
            style={{
              padding: 20,
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13 }}>
              The sample member’s record, over a scrim. Escape closes it.
            </span>
            <Button variant="pri" onClick={() => setDrawerOpen(true)}>
              Open drawer
            </Button>
          </div>
          {drawerOpen ? (
            <MemberDrawer member={maya} data={SAMPLE_DATA} onClose={() => setDrawerOpen(false)} />
          ) : null}
        </Section>

        <Section name="StateNotice">
          <StateNotice
            stamp="Access decision · Denied"
            headline="You can view this role, but you can’t change it."
            facts={[
              "Missing — Edit role permissions",
              "Protected — Support lead · 4 members",
              "Ask — the organization owner",
            ]}
            action={{ label: "Ask the owner to make the change", href: "#" }}
            wayOut={{ label: "Review my access", href: "/app/me" }}
            alert
          >
            Changing a role needs the permission{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              Edit role permissions
            </b>
            . Only the organization owner has it.
          </StateNotice>
        </Section>

        <Section name="ReconnectBanner">
          <div
            style={{
              border: "1px solid var(--frame)",
              borderRadius: "var(--radius-l)",
              overflow: "hidden",
            }}
          >
            <ReconnectBanner pausedAt="10:41 AM" />
          </div>
        </Section>

        <Section name="WizardSteps">
          <WizardSteps
            steps={[
              { n: "1", name: "Start from", summary: "Support lead", state: "done" },
              { n: "2", name: "Permissions", summary: "3 changed of 18", state: "current" },
              { n: "3", name: "Review and assign", summary: "", state: "todo" },
            ]}
          />
        </Section>

        <Section name="LegalFooter">
          <div className="sheet">
            <LegalFooter />
          </div>
        </Section>
      </div>
    </div>
  );
}
