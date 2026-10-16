"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * X-06 conflict sheet (SysReconnect.html): the dark panel that shows a
 * change which arrived while the connection was down, next to the change
 * made offline. Nothing is saved until the person chooses.
 * (HANDOVER §7 says the conflict sheet is "outlined in --seal"; the final
 * v2 screen draws a dark ink panel with a --panel-card inset instead —
 * the screen wins, logged as a deviation in the system batch log.)
 */
export function ConflictSheet() {
  const [choice, setChoice] = useState<"pending" | "kept" | "discarded">(
    "pending",
  );

  return (
    <section
      className="sys-dpanel sys-conflict"
      aria-labelledby="offline-conflict"
      style={{ gap: 14 }}
    >
      <h2 id="offline-conflict">
        While you were offline, 1 change came in
      </h2>
      {choice === "pending" ? (
        <>
          <div className="sys-conflict-card">
            <b>Lucas Meyer</b> moved <b>Zoe Adams</b> from Member to Analyst
            at 10:43. You also changed Zoe’s team at 10:44.
          </div>
          <span className="sys-conflict-note">
            Both can apply: your team change doesn’t touch her role. Nothing
            is saved until you choose.
          </span>
          <div className="sys-conflict-actions">
            <Button variant="white" onClick={() => setChoice("kept")}>
              Keep both changes
            </Button>
            <Button variant="on-dark" onClick={() => setChoice("discarded")}>
              Discard my team change
            </Button>
          </div>
        </>
      ) : (
        <p role="status" className="sys-conflict-saved">
          {choice === "kept"
            ? "Both changes kept. They will be saved when the connection is back."
            : "Your team change was discarded. Lucas Meyer’s change to Zoe Adams stays, and will be saved when the connection is back."}
        </p>
      )}
    </section>
  );
}
