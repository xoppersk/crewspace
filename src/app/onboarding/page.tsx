import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2, MailOpen } from "lucide-react";

import { requireUser } from "@/lib/auth/require-user";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateOrgForm } from "./_components/create-org-form";
import { JoinWithInviteForm } from "./_components/join-with-invite-form";

export const metadata: Metadata = { title: "Get started" };

/**
 * Session-gated first-run route: requireUser() reads the session cookie, so
 * this page renders at request time instead of prerendering.
 * (Mirrors the `instant = false` opt-out used by the (app) and (auth) groups.)
 */
export const instant = false;

/**
 * First-run for signed-in users with no orgs (APP-FLOW §1, Flow A):
 * create an organization, or join with an invite.
 *
 * The join-with-invite card routes to /invite/accept, where the token state
 * machine (valid / new-user / different-user / invalid / expired) takes over.
 */
export default async function OnboardingPage() {
  const user = await requireUser("/onboarding");
  const supabase = await createClient();

  const { count } = await supabase
    .from("memberships")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  if (count && count > 0) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center gap-8 px-4 py-12">
      <div className="text-center">
        <p className="text-sm font-medium text-muted-foreground">Step 1 of 2</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Welcome to Crewspace</h1>
        <p className="mt-2 text-muted-foreground">
          Set up your first organization, or join one you were invited to.
        </p>
      </div>

      <div className="grid w-full gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4" /> Create an organization
            </CardTitle>
            <CardDescription>
              You become the owner, with the five system roles seeded automatically.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CreateOrgForm />
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MailOpen className="size-4" /> Join with an invite
            </CardTitle>
            <CardDescription>
              Got an invitation email? Paste the token or link and accept it.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col justify-end">
            <JoinWithInviteForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
