"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X } from "lucide-react";

/**
 * One-time success toast shown when the role wizard lands on the new role's
 * detail page (?created=1). Dismisses itself and cleans the query param so
 * a refresh doesn't re-show it. (No toast library in the starter — this is
 * the lightweight in-house version.)
 */
export function RoleCreatedToast({ roleName }: { roleName: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  const visible = searchParams.get("created") === "1" && !dismissed;

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setDismissed(true), 6000);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("created");
    const query = params.toString();
    router.replace(query ? `?${query}` : "?", { scroll: false });
    return () => clearTimeout(timer);
  }, [visible, router, searchParams]);

  if (!visible) return null;

  return (
    <div
      role="status"
      className="fixed bottom-6 left-1/2 z-50 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-lg border bg-card p-4 shadow-lg"
    >
      <CheckCircle2 className="size-5 shrink-0 text-emerald-600" aria-hidden />
      <p className="flex-1 text-sm">
        <span className="font-semibold">Role created.</span>{" "}
        <span className="text-muted-foreground">“{roleName}” is ready to assign.</span>
      </p>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
