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
import {
  IconCheck,
  IconLock,
  IconShieldCheck,
} from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";
import { ExpiredState } from "@/components/States";

/* Screen-worded labels for what the invited role allows, keyed by the
   fixture permission numbers (7 = Read audit log, 15 = View billing). */
const CAN_LABELS: Record<number, string> = {
  7: "Read the audit log",
  15: "View billing and invoices",
};

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

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

  /* What the role allows today, resolved through the baseline: for the
     Analyst that is Read audit log (7) and View billing (15) — every
     other setting resolves to Blocked. */
  const can = getPermissions()
    .filter(
      (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
    )
    .map((p) => CAN_LABELS[p.id] ?? p.name);

  const mix = teamRoleMix(team.id);
  const mixCount = (roleId: string) =>
    mix.find((m) => m.role.id === roleId)?.count ?? 0;
  const expiresLong = invitation.expires.replace("Oct", "October");
  const article = /^[aeiou]/i.test(role.name) ? "an" : "a";

  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
      </header>

      <div className="auth-grid">
        <form
          className="auth-form fa-form-lg"
          style={{ flex: "1 1 420px", maxWidth: 500 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <span style={{ display: "flex" }}>
              <span
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--radius-l)",
                  background: "var(--ink-bar)",
                  color: "#fff",
                  display: "grid",
                  placeItems: "center",
                  flex: "none",
                  font: "800 14px/1 var(--font-sans)",
                }}
              >
                SL
              </span>
              <span
                className="av"
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  marginLeft: -5,
                  /* Screen-literal avatar tint for Daniel Okafor. */
                  background: "#dce3f4",
                  fontSize: 13,
                }}
              >
                {lead ? initialsOf(lead.name) : ""}
              </span>
            </span>
            <span className="fchip">
              <i />
              Invitation · expires {expiresLong}
            </span>
          </div>

          <h1 className="ft-32">
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
            team as {article}{" "}
            <b style={{ fontWeight: 600, color: "var(--ink)" }}>
              {role.name}
            </b>
            .
          </p>

          <div className="fcanbox">
            <div className="fcanrow">
              <span className="dot ok">
                <IconCheck />
              </span>
              <span>
                <b>As {article} {role.name} you can</b>
                <span className="sub">{can.join(" · ")}</span>
              </span>
            </div>
            <div className="fcanrow">
              <span className="dot">
                <IconLock />
              </span>
              <span>
                <b>You can’t</b>
                <span className="sub">
                  Invite or remove people, change roles, or change settings.
                </span>
              </span>
            </div>
          </div>

          <ButtonLink
            variant="pri"
            href="/app"
            style={{ width: "100%", height: 46, fontSize: 14 }}
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
          <a
            href="#"
            className="btn"
            style={{ width: "100%", height: 46, fontSize: 14 }}
          >
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

        <aside
          className="fdark"
          style={{
            alignSelf: "flex-start",
            flex: "1 1 320px",
            maxWidth: 380,
            padding: 28,
            gap: 16,
          }}
        >
          <h2 style={{ margin: 0, font: "700 18px/1.2 var(--font-sans)" }}>
            On the {team.name} team
          </h2>
          {lead ? (
            <div
              className="fpanel-card"
              style={{
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <span
                className="av"
                aria-hidden="true"
                style={{
                  width: 34,
                  height: 34,
                  border: 0,
                  /* Screen-literal avatar tint for Daniel Okafor. */
                  background: "#dce3f4",
                }}
              >
                {initialsOf(lead.name)}
              </span>
              <span
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <b style={{ fontSize: 14, fontWeight: 600 }}>{lead.name}</b>
                <span style={{ fontSize: 12.5, color: "var(--panel-muted)" }}>
                  team lead
                </span>
              </span>
            </div>
          ) : null}
          <div>
            <div className="fdk">
              <span>Product admins</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {mixCount("product-admin")}
              </span>
            </div>
            <div className="fdk">
              <span>Analysts</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {mixCount("analyst")}
              </span>
            </div>
            <div className="fdk last">
              <span>Members</span>
              <span className="mono" style={{ fontSize: 13 }}>
                {mixCount("member")}
              </span>
            </div>
          </div>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              lineHeight: 1.55,
              color: "var(--panel-muted)",
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
