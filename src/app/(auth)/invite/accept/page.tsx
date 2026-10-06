import type { Metadata } from "next";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { AuthCard } from "../../_components/auth-card";
import { AcceptFlow } from "./accept-flow";

export const metadata: Metadata = { title: "Accept invitation" };

/**
 * /invite/accept — the invitation accept flow (APP-FLOW §3, auth screens).
 * Rendered inside the shared auth card shell; the state machine itself lives
 * in the client AcceptFlow (useSearchParams needs a Suspense boundary).
 */
export default function InviteAcceptPage() {
  return (
    <AuthCard title="You're invited" description="Review and accept your invitation.">
      <Suspense
        fallback={
          <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Verifying your invitation…</p>
          </div>
        }
      >
        <AcceptFlow />
      </Suspense>
    </AuthCard>
  );
}
