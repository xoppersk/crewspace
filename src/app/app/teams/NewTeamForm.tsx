"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTeam } from "@/lib/data/actions";
import { Button } from "@/components/Button";

/** New team — creates a real team row (teams:create checked server-side). */
export function NewTeamForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <Button variant="pri" onClick={() => setOpen(true)}>
        + New team
      </Button>
    );
  }
  return (
    <form
      style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const res = await createTeam({ name, blurb });
        setBusy(false);
        if (res.ok) {
          setOpen(false);
          setName("");
          setBlurb("");
          router.refresh();
        } else {
          setNote(res.error);
        }
      }}
    >
      <input
        className="in"
        style={{ height: 40 }}
        placeholder="Team name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <input
        className="in"
        style={{ height: 40 }}
        placeholder="What the team does"
        value={blurb}
        onChange={(e) => setBlurb(e.target.value)}
      />
      <Button variant="pri" type="submit" disabled={busy}>
        Create team
      </Button>
      <Button onClick={() => setOpen(false)}>Cancel</Button>
      {note ? <span style={{ fontSize: 13 }}>{note}</span> : null}
    </form>
  );
}
