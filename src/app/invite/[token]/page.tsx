import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getInvitations,
  getMember,
  getOrg,
  getPermissions,
  getRole,
  getTeam,
  settingResult,
  teamRoleMix,
} from "@/lib/api";
import { ButtonLink } from "@/components/Button";
import { LegalFooter } from "@/components/LegalFooter";
import { ExpiredState } from "@/components/States";

/* Short, screen-worded labels for what the invited role allows. */
const CAN_LABELS: Record<number, string> = {
  13: "Read the audit log",
  15: "View billing and invoices",
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const { state } = await searchParams;
  if (token === "expired" || state === "expired")
    return { title: "Crewspace — Invitation expired" };
  return { title: "Crewspace — Join Sevyn Labs" };
}

/**
 * F-04 — Accept an invitation. The canonical invitation is Priya Shah's
 * (inv-priya): Daniel Okafor invited her as Analyst on Product.
 * token "expired" (or ?state=expired) renders X-03 instead.
 */
export default async function InviteAcceptPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { token } = await params;
  const { state } = await searchParams;
  if (token === "expired" || state === "expired") return <ExpiredState />;

  const org = getOrg();
  const invitation = getInvitations().find((i) => i.id === "inv-priya");
  if (!invitation) notFound();
  const inviter = getMember(invitation.invitedById)!;
  const role = getRole(invitation.roleId)!;
  const team = getTeam(invitation.teamId)!;
  const lead = team.leadId ? getMember(team.leadId) : undefined;

  /* What the role allows today, resolved through the baseline. */
  const can = getPermissions()
    .filter(
      (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
    )
    .map((p) => CAN_LABELS[p.id] ?? p.name);

  const mix = teamRoleMix(team.id);
  const mixCount = (roleId: string) =>
    mix.find((m) => m.role.id === roleId)?.count ?? 0;
  const expiresLong = invitation.expires.replace("Oct", "October");

  return (
    <div className="pub">
      <header className="auth-head">
        <Link href="/" className="wordmark">
          Crewspace
        </Link>
      </header>

      <div className="auth-grid">
        <form className="auth-form" style={{ maxWidth: 440 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Invitation · expires {expiresLong}
          </span>
          <h1
            className="public-title"
            style={{ fontSize: 34 }}
          >
            {inviter.name} invited you to {org.name}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ink-2)",
            }}
          >
            You’ll join the{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              {team.name}
            </b>{" "}
            team as an{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              {role.name}
            </b>
            .
          </p>

          <div
            className="sheet"
            style={{
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <b style={{ fontWeight: 600 }}>As an {role.name} you can</b>
            <span style={{ color: "var(--ink-2)" }}>{can.join(" · ")}</span>
            <b style={{ fontWeight: 600, marginTop: 4 }}>You can’t</b>
            <span style={{ color: "var(--ink-2)" }}>
              Invite or remove people, change roles, or change settings.
            </span>
          </div>

          <ButtonLink
            variant="pri"
            size="h44"
            href="/app"
            style={{ width: "100%" }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              aria-hidden="true"
              style={{ color: "var(--on-seal)" }}
            >
              <path
                fill="currentColor"
                d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5zM9 18c2.4 0 4.5-.8 5.9-2.2L12 13.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H1v2.3A9 9 0 0 0 9 18zM4 10.8a5.4 5.4 0 0 1 0-3.5V5H1a9 9 0 0 0 0 8.1l3-2.3zM9 3.6c1.3 0 2.5.5 3.4 1.3L15 2.4A9 9 0 0 0 1 5l3 2.3c.7-2.1 2.7-3.7 5-3.7z"
              />
            </svg>
            Accept with {invitation.email}
          </ButtonLink>
          <a href="#" className="btn h44" style={{ width: "100%" }}>
            Decline
          </a>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--muted)",
            }}
          >
            You must sign in with the address this was sent to. Signed in as
            someone else? <a href="#">Switch account</a>
          </p>
        </form>

        <aside className="auth-side" style={{ maxWidth: 360, paddingTop: 34 }}>
          <h2 className="panel" style={{ marginBottom: 8 }}>
            On the {team.name} team
          </h2>
          {lead ? (
            <div className="ll big">
              <span>{lead.name}</span>
              <i />
              <span style={{ fontSize: 13, color: "var(--muted)" }}>
                team lead
              </span>
            </div>
          ) : null}
          <div className="ll big">
            <span>Product admins</span>
            <i />
            <span className="mono" style={{ fontSize: 13 }}>
              {mixCount("product-admin")}
            </span>
          </div>
          <div className="ll big">
            <span>Analysts</span>
            <i />
            <span className="mono" style={{ fontSize: 13 }}>
              {mixCount("analyst")}
            </span>
          </div>
          <div
            className="ll big"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <span>Members</span>
            <i />
            <span className="mono" style={{ fontSize: 13 }}>
              {mixCount("member")}
            </span>
          </div>
          <p
            style={{
              margin: "12px 0 0",
              fontSize: 13,
              lineHeight: 1.5,
              color: "var(--muted)",
            }}
          >
            When you accept, your register number is assigned and the change
            is written to {org.name}’ audit log.
          </p>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
