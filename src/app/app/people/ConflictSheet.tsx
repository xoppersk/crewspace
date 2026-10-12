"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

/**
 * X-06 conflict sheet (SysReconnect.html): a change that arrived while the
 * connection was down, next to the change made offline. Nothing is saved
 * until the person chooses.
 */
export function ConflictSheet() {
  const [choice, setChoice] = useState<"pending" | "kept" | "discarded">(
    "pending",
  );

  return (
    <section
      className="sheet"
      aria-labelledby="offline-conflict"
      style={{
        padding: "18px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        borderColor: "var(--seal)",
      }}
    >
      <h2 id="offline-conflict" className="panel">
        While you were offline, 1 change came in
      </h2>
      {choice === "pending" ? (
        <>
          <span style={{ fontSize: 14, lineHeight: 1.5 }}>
            <b style={{ fontWeight: 600 }}>Lucas Meyer</b> moved{" "}
            <b style={{ fontWeight: 600 }}>Zoe Adams</b> from Member to Analyst
            at 10:43. You also changed Zoe’s team at 10:44.
          </span>
          <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
            Both can apply: your team change doesn’t touch her role. Nothing is
            saved until you choose.
          </span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="pri" size="h40" onClick={() => setChoice("kept")}>
              Keep both changes
            </Button>
            <Button size="h40" onClick={() => setChoice("discarded")}>
              Discard my team change
            </Button>
          </div>
        </>
      ) : (
        <p role="status" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
          {choice === "kept"
            ? "Both changes kept. They will be saved when the connection is back."
            : "Your team change was discarded. Lucas Meyer’s change to Zoe Adams stays, and will be saved when the connection is back."}
        </p>
      )}
    </section>
  );
}
