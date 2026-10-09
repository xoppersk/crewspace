import { Lock } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * PermissionDenied — the inline state for gated routes (UI-DESIGN.md §2.4).
 * Lock icon, plain-language reason, "who to ask" line naming the org's
 * owners — never a raw 403.
 */
export function PermissionDenied({
  reason,
  askLine,
  backHref,
}: {
  /** Plain-language reason, e.g. "Invitations are managed by owners, admins, and managers." */
  reason: string;
  /** "Who to ask" line, e.g. "Ask Maya Chen (owner) for access." */
  askLine: string;
  /** Where the back link goes (defaults to the org dashboard). */
  backHref?: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted">
        <Lock className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <h1 className="text-xl font-semibold tracking-tight">You don’t have access here</h1>
      <p className="text-sm text-muted-foreground">{reason}</p>
      <p className="text-sm font-medium">{askLine}</p>
      {backHref ? (
        <Button variant="outline" asChild className="mt-2">
          <Link href={backHref}>Back to dashboard</Link>
        </Button>
      ) : null}
    </div>
  );
}
