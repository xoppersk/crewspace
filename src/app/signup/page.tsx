import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, getGateState } from "@/lib/data/server";
import { PERMISSION_GROUPS } from "@/lib/data/permissions";
import { GoogleButton } from "@/components/GoogleButton";
import { IconShieldCheck } from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";
import { AccountForm, WorkspaceForm } from "./SignupForms";

export const metadata: Metadata = { title: "Crewspace — Start a register" };

/**
 * F-03 — Sign up, the designed 3 steps made real:
 *  1. Account — Supabase Auth signUp (name, email, password), or
 *     Google. With email confirmation on, this step ends at the
 *     "check your email" notice and resumes after the callback.
 *  2. Workspace — create_workspace RPC; the signer becomes owner.
 *  3. Invite — /app/setup/invite (createWorkspaceAction lands there).
 * A visitor who already has a workspace goes straight to /app; an
 * invite `?next=` is honored after sign-up.
 */
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const next =
    sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//")
      ? sp.next
      : undefined;

  const gate = await getGateState();
  if (gate.kind === "active") redirect(next ?? "/app");
  const user = gate.kind === "signed-out" ? null : await getCurrentUser();
  const step = user ? 2 : 1;
  const emailDomain = user?.email?.split("@")[1] ?? "";

  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          Already have one?{" "}
          <Link href="/signin" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </span>
      </header>

      <div className="auth-grid">
        <div style={{ flex: "1 1 400px", maxWidth: 480 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 18,
            }}
          >
            <div className="fprog" aria-hidden="true">
              <i className={step >= 1 ? "on" : undefined} />
              <i className={step >= 2 ? "on" : undefined} />
              <i />
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Step {step} of 3 ·{" "}
              {step === 1
                ? "then create your workspace, then invite people"
                : "then invite people, then check roles"}
            </span>
          </div>
          <h1 className="ft-34" style={{ marginBottom: 18 }}>
            {step === 1
              ? "Start your organization’s register"
              : "Name your workspace"}
          </h1>
          {step === 1 ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <GoogleButton
                  label="Continue with Google"
                  href={`/auth/google?next=${encodeURIComponent(next ?? "/signup")}`}
                  height={46}
                />
              </div>
              <AccountForm next={next} />
            </>
          ) : (
            <WorkspaceForm email={user!.email ?? ""} emailDomain={emailDomain} />
          )}
        </div>

        <aside
          className="fdark"
          style={{
            alignSelf: "flex-start",
            flex: "1 1 340px",
            maxWidth: 400,
            padding: 28,
            gap: 18,
          }}
        >
          <div>
            <h2
              style={{
                margin: "0 0 6px",
                font: "700 15px/1.3 var(--font-sans)",
              }}
            >
              What you’ll have
            </h2>
            <div className="fdk">
              <span>You, as owner</span>
              <span>full access</span>
            </div>
            <div className="fdk">
              <span>Ready-made roles</span>
              <span>9, from Owner to Guest</span>
            </div>
            <div className="fdk">
              <span>Permissions to set</span>
              <span>
                18, in {PERMISSION_GROUPS.length} groups
              </span>
            </div>
            <div className="fdk last">
              <span>Audit log</span>
              <span>from the first minute</span>
            </div>
          </div>
          <div className="fpanel-card" style={{ padding: 14 }}>
            <div
              className="fgroupstrip"
              role="img"
              aria-label="18 permissions in 8 groups, none set yet"
            >
              {PERMISSION_GROUPS.map((g) => (
                <span
                  key={g.name}
                  className="fg"
                  style={{
                    gridTemplateColumns: `repeat(${g.permissionIds.length}, minmax(0, 1fr))`,
                    flex: `${g.permissionIds.length} 1 0`,
                  }}
                >
                  {g.permissionIds.map((id) => (
                    <i key={id} />
                  ))}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
