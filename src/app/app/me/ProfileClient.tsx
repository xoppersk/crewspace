"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

/* P-05 interactive parts — screens/Profile.html.
   The profile form's fields are controlled so edits are tracked. The
   screen shows no dirty-state styling and no post-save state, so none
   is added. */

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "180px minmax(0, 1fr)",
  gap: "8px 20px",
  alignItems: "center",
  padding: "12px 24px",
  borderTop: "1px solid var(--rule)",
};

const labelStyle: React.CSSProperties = { fontWeight: 600, fontSize: 13 };

function Small({ children }: { children: React.ReactNode }) {
  return (
    <small
      style={{
        display: "block",
        fontWeight: 400,
        color: "var(--muted)",
        fontSize: 12,
        marginTop: 2,
      }}
    >
      {children}
    </small>
  );
}

export function ProfileForm({
  initialName,
  initialTitle,
  email,
}: {
  initialName: string;
  initialTitle: string;
  email: string;
}) {
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [pronouns, setPronouns] = useState("she/her");
  const [tz, setTz] = useState("Eastern Time · Philadelphia");

  return (
    <form
      className="sheet"
      aria-labelledby="pf"
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 8,
          padding: "16px 24px 12px",
        }}
      >
        <h2 id="pf" className="section">
          Profile
        </h2>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>
          Everyone in Sevyn Labs sees this
        </span>
      </div>
      <div style={rowStyle}>
        <label htmlFor="nm" style={labelStyle}>
          Name
        </label>
        <input
          id="nm"
          className="in"
          style={{ height: 38, width: "100%", maxWidth: 360 }}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="tt" style={labelStyle}>
          Title
        </label>
        <input
          id="tt"
          className="in"
          style={{ height: 38, width: "100%", maxWidth: 360 }}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div style={rowStyle}>
        <label htmlFor="pr" style={labelStyle}>
          Pronouns <Small>Optional</Small>
        </label>
        <input
          id="pr"
          className="in"
          style={{ height: 38, width: "100%", maxWidth: 360 }}
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
        />
      </div>
      <div style={rowStyle}>
        <span style={labelStyle}>
          Work email <Small>Set by your invitation</Small>
        </span>
        <span style={{ fontSize: 14, color: "var(--ink-2)" }}>{email}</span>
      </div>
      <div style={rowStyle}>
        <label htmlFor="tz" style={labelStyle}>
          Time zone
        </label>
        <select
          id="tz"
          className="in"
          style={{ height: 38, width: "100%", maxWidth: 360 }}
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          <option>Eastern Time · Philadelphia</option>
          <option>Central Time</option>
          <option>Pacific Time</option>
        </select>
      </div>
      <div
        style={{
          padding: "14px 24px",
          borderTop: "1px solid var(--rule-strong)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
        }}
      >
        <Button variant="pri" type="submit">
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function EmailSettings() {
  const [accepts, setAccepts] = useState(true);
  const [joins, setJoins] = useState(false);
  const checkStyle: React.CSSProperties = {
    display: "flex",
    gap: 10,
    alignItems: "flex-start",
    padding: "8px 0",
    fontSize: 13,
    lineHeight: 1.45,
    cursor: "pointer",
  };
  const boxStyle: React.CSSProperties = {
    margin: "2px 0 0",
    width: 16,
    height: 16,
    accentColor: "var(--seal)",
  };
  return (
    <section
      className="sheet"
      aria-labelledby="nt"
      style={{ padding: "18px 20px 10px" }}
    >
      <h2 id="nt" className="panel" style={{ marginBottom: 4 }}>
        Email me when
      </h2>
      <label style={checkStyle}>
        <input type="checkbox" checked disabled style={boxStyle} /> My role or
        access changes{" "}
        <span style={{ color: "var(--muted)" }}>· always on</span>
      </label>
      <label style={checkStyle}>
        <input
          type="checkbox"
          checked={accepts}
          onChange={(e) => setAccepts(e.target.checked)}
          style={boxStyle}
        />{" "}
        Someone accepts an invitation I sent
      </label>
      <label style={checkStyle}>
        <input
          type="checkbox"
          checked={joins}
          onChange={(e) => setJoins(e.target.checked)}
          style={boxStyle}
        />{" "}
        Someone joins a team I’m on
      </label>
    </section>
  );
}
