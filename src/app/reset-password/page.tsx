import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/data/server";
import { IconShieldCheck } from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";
import { RequestResetForm, SetPasswordForm } from "./ResetForms";

export const metadata: Metadata = { title: "Crewspace — Reset password" };

/**
 * Password reset, both halves:
 *  - no session → request form (resetPasswordForEmail; the email link
 *    returns through /auth/callback?next=/reset-password);
 *  - session (arrived from the recovery link, or just signed in) → the
 *    set-a-new-password form (updateUser).
 * This is also how the owner account's first password gets set:
 * xoppersk@gmail.com requests a reset like anyone else — no password
 * is ever seeded.
 */
export default async function ResetPasswordPage() {
  const user = await getCurrentUser();
  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
        <Link href="/signin" style={{ fontSize: 14, fontWeight: 600 }}>
          Sign in
        </Link>
      </header>

      <div
        className="auth-grid"
        style={{ justifyContent: "center" }}
      >
        <div style={{ flex: "1 1 380px", maxWidth: 460 }}>
          <h1 className="ft-34" style={{ marginBottom: 6 }}>
            {user ? "Set a new password" : "Reset your password"}
          </h1>
          <p
            style={{
              margin: "0 0 18px",
              fontSize: 14.5,
              lineHeight: 1.55,
              color: "var(--ink-2)",
            }}
          >
            {user
              ? "Choose a new password for your account. You’ll stay signed in."
              : "We’ll email you a link. Open it and you can set a new password right away."}
          </p>
          {user ? <SetPasswordForm /> : <RequestResetForm />}
        </div>
      </div>

      <LegalFooter />
    </div>
  );
}
