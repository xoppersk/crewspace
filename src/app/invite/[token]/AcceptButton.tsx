"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvitation } from "@/lib/data/actions";
import { Button } from "@/components/Button";

/**
 * Accept control for /invite/[token] when signed in: runs the
 * accept_invitation RPC via the server action (which verifies the
 * signed-in account matches), then lands in the workspace.
 */
export function AcceptButton({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await acceptInvitation(token);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push("/app");
  }

  return (
    <>
      <Button
        variant="pri"
        disabled={busy}
        onClick={() => void accept()}
        style={{ width: "100%", height: 46, fontSize: 14 }}
      >
        Accept with {email}
      </Button>
      {error ? (
        <p role="alert" style={{ margin: 0, fontSize: 13.5, color: "var(--deny)" }}>
          {error}
        </p>
      ) : null}
    </>
  );
}
