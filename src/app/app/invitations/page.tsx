import type { Metadata } from "next";
import {
  getInvitations,
  getMember,
  getRole,
  getTeam,
  invitationTabCounts,
  roleAllows,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { ButtonLink } from "@/components/Button";
import {
  InvitationsClient,
  type InvitationView,
  type TabKey,
} from "./InvitationsClient";

export const metadata: Metadata = { title: "Crewspace — Invitations" };

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: tabParam } = await searchParams;
  const counts = invitationTabCounts();
  const initialTab: TabKey =
    tabParam === "accepted" || tabParam === "expired" || tabParam === "revoked"
      ? tabParam
      : "open";

  const views: InvitationView[] = getInvitations().map((inv) => ({
    id: inv.id,
    name: inv.name,
    email: inv.email,
    suggestedEmail: inv.suggestedEmail,
    roleId: inv.roleId,
    roleName: getRole(inv.roleId)?.name ?? "",
    teamId: inv.teamId,
    teamName: getTeam(inv.teamId)?.name ?? "",
    inviterName: getMember(inv.invitedById)?.name ?? "",
    sent: inv.sent,
    status: inv.status,
    openedAt: inv.openedAt,
    expires: inv.expires,
    acceptedOn: inv.acceptedOn,
  }));

  const inviteRoles = ["member", "analyst", "support-lead", "product-admin"]
    .map((id) => getRole(id)!)
    .filter(Boolean)
    .map((r) => ({ id: r.id, name: r.name, allows: roleAllows(r) }));
  /* The screen designs exactly three teams here, Product first (G-01). */
  const inviteTeams = ["product", "customer-operations", "engineering"]
    .map((id) => getTeam(id))
    .filter((t) => t !== undefined)
    .map((t) => ({ id: t.id, name: t.name }));

  return (
    <AppShell current="invitations">
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Invitations</h1>
          <p className="gov-lede">
            {counts.open} invitations are open. One didn’t arrive and one
            expires in 3 days. An invitation becomes a member only when the
            person signs in with the address it was sent to.
          </p>
        </div>
        <div className="head-actions">
          <ButtonLink href="/app/invitations/import">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <path d="M8 10.5V2.5M4.8 5.5 8 2.3l3.2 3.2" />
              <path d="M2.5 10.5v2.5h11v-2.5" />
            </svg>
            Import from CSV
          </ButtonLink>
        </div>
      </div>

      <InvitationsClient
        initialInvitations={views}
        initialTab={initialTab}
        roles={inviteRoles}
        teams={inviteTeams}
      />
    </AppShell>
  );
}
