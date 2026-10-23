"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setTeamMembership } from "@/lib/data/actions";

/** Row action on a team record: remove this person from the team
    (teams:manage is re-checked in the server action). */
export function TeamRowActions({
  membershipId,
  teamId,
  memberName,
}: {
  membershipId: string;
  teamId: string;
  memberName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
      <button
        type="button"
        className="mx"
        style={{ width: "auto", padding: "0 8px", fontSize: 12.5 }}
        disabled={busy}
        aria-label={`Remove ${memberName} from this team`}
        onClick={async () => {
          setBusy(true);
          const res = await setTeamMembership(membershipId, teamId, false);
          setBusy(false);
          if (res.ok) router.refresh();
          else setNote(res.error);
        }}
      >
        Remove
      </button>
      {note ? <span style={{ fontSize: 12 }}>{note}</span> : null}
    </span>
  );
}
