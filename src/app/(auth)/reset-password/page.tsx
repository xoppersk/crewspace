import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "../_components/auth-card";
import { ResetRequestForm } from "./request-form";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Reset password" };

/**
 * Two-step password reset on one route (APP-FLOW §3):
 *   ?step=request — enter email, receive a reset link (default)
 *   ?step=confirm — arrived via the email link (live session), set new password
 */
function ResetPasswordSteps({ step }: { step: string | undefined }) {
  if (step === "confirm") {
    return (
      <AuthCard
        title="Choose a new password"
        description="Enter and confirm your new password below."
        footer={
          <p className="text-sm text-muted-foreground">
            <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
              Back to sign in
            </Link>
          </p>
        }
      >
        <ResetPasswordForm />
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Enter your account email and we'll send you a reset link."
      footer={
        <p className="text-sm text-muted-foreground">
          Remember it now?{" "}
          <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </p>
      }
    >
      <ResetRequestForm />
    </AuthCard>
  );
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  return (
    <Suspense>
      <ResetPasswordSteps step={step} />
    </Suspense>
  );
}
