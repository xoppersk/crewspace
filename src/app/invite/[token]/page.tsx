import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/data/server";
import { ButtonLink } from "@/components/Button";
import { IconCheck, IconLock, IconShieldCheck } from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";
import { ExpiredState } from "@/components/States";
import { AcceptButton } from "./AcceptButton";

export const metadata: Metadata = { title: "Crewspace — Invitation" };

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function monogramOf(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * F-04 — Accept an invitation, for real. The raw token from the URL
 * is looked up through get_invitation_preview (00012 — the DB stores
 * only its SHA-256 hash). States:
 *  - no preview row → the link is invalid;
 *  - status accepted/revoked/expired, or past expires_at → X-03, the
 *    designed expired screen, with the real org/email/inviter;
 *  - pending + signed out → the invite card with sign-in / sign-up
 *    routes that return here (next=/invite/<token>);
 *  - pending + signed in → Accept runs the accept_invitation RPC
 *    (00007), which creates the membership, joins the teams, and
 *    writes the audit row.
 */
export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: previewRows } = await supabase.rpc("get_invitation_preview", {
    p_token: token,
  });
  const preview = previewRows?.[0];

  const shell = (children: React.ReactNode) => (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
      </header>
      {children}
      <LegalFooter />
    </div>
  );

  if (!preview) {
    return shell(
      <main
        className="auth-form fa-form-lg"
        style={{ flex: "1 1 420px", maxWidth: 500, margin: "40px auto" }}
      >
        <h1 className="ft-32">This invitation link doesn’t work</h1>
        <p style={{ fontSize: 16, lineHeight: 1.55, color: "var(--ink-2)" }}>
          The link may have been copied incompletely, or the invitation
          was replaced by a newer one. Ask the person who invited you to
          send a fresh link.
        </p>
        <ButtonLink href="/signin" style={{ height: 46, fontSize: 14 }}>
          Sign in
        </ButtonLink>
      </main>,
    );
  }

  const expired =
    preview.status !== "pending" ||
    new Date(preview.expires_at).getTime() < Date.now();
  if (expired) {
    return (
      <ExpiredState
        orgName={preview.org_name}
        email={preview.email}
        inviterName={preview.inviter_name}
        expiredLabel={
          preview.status === "accepted"
            ? "Already accepted"
            : preview.status === "revoked"
              ? "Withdrawn"
              : "Expired"
        }
      />
    );
  }

  const user = await getCurrentUser();
  const roleName = preview.role_name ?? "Member";
  const article = /^[aeiou]/i.test(roleName) ? "an" : "a";
  const canLabels = preview.permission_labels ?? [];
  const expiresLong = new Date(preview.expires_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric" },
  );
  const next = `/invite/${token}`;

  return shell(
    <div className="auth-grid">
      <div
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
              {monogramOf(preview.org_name)}
            </span>
            <span
              className="av"
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                marginLeft: -5,
                background: "#dce3f4",
                fontSize: 13,
              }}
            >
              {initialsOf(preview.inviter_name)}
            </span>
          </span>
          <span className="fchip">
            <i />
            Invitation · expires {expiresLong}
          </span>
        </div>

        <h1 className="ft-32">
          {preview.inviter_name} invited you to {preview.org_name}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 16,
            lineHeight: 1.55,
            color: "var(--ink-2)",
          }}
        >
          You’ll join as {article}{" "}
          <b style={{ fontWeight: 600, color: "var(--ink)" }}>{roleName}</b>.
        </p>

        <div className="fcanbox">
          <div className="fcanrow">
            <span className="dot ok">
              <IconCheck />
            </span>
            <span>
              <b>
                As {article} {roleName} you can
              </b>
              <span className="sub">
                {canLabels.length
                  ? canLabels.join(" · ")
                  : "Use the workspace as a member"}
              </span>
            </span>
          </div>
          <div className="fcanrow">
            <span className="dot">
              <IconLock />
            </span>
            <span>
              <b>Your access is set by this role</b>
              <span className="sub">
                Anything the role doesn’t allow stays blocked — the
                register shows the full list once you’re in.
              </span>
            </span>
          </div>
        </div>

        {user ? (
          <>
            <AcceptButton token={token} email={preview.email} />
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--muted)",
              }}
            >
              You must accept with the account for {preview.email}.
              Signed in as someone else?{" "}
              <Link href="/signin">Switch account</Link>
            </p>
          </>
        ) : (
          <>
            <ButtonLink
              variant="pri"
              href={`/signup?next=${encodeURIComponent(next)}`}
              style={{ width: "100%", height: 46, fontSize: 14 }}
            >
              Create account with {preview.email}
            </ButtonLink>
            <ButtonLink
              href={`/signin?next=${encodeURIComponent(next)}`}
              style={{ width: "100%", height: 46, fontSize: 14 }}
            >
              Sign in to accept
            </ButtonLink>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--muted)",
              }}
            >
              You must sign in with the address this was sent to.
            </p>
          </>
        )}
      </div>

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
          The {roleName} role
        </h2>
        {preview.role_description ? (
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "var(--panel-muted)",
            }}
          >
            {preview.role_description}
          </p>
        ) : null}
        <div>
          <div className="fdk">
            <span>Permissions allowed</span>
            <span className="mono" style={{ fontSize: 13 }}>
              {canLabels.length}
            </span>
          </div>
          <div className="fdk last">
            <span>Invited by</span>
            <span style={{ fontSize: 13 }}>{preview.inviter_name}</span>
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
          When you accept, your membership is created and the acceptance
          is written to {preview.org_name}’s audit log.
        </p>
      </aside>
    </div>,
  );
}
