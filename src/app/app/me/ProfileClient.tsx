"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { IconLock } from "@/components/icons";

/* P-05 interactive parts — screens/Profile.html.
   The profile form's fields are controlled so edits are tracked. The
   screen shows no dirty-state styling and no post-save state, so none
   is added. Row metrics live in the .p-fr class (people.css, the
   screen's .fr) so phones can stack label above control. */

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
      className="card"
      aria-labelledby="pf"
      style={{ overflow: "hidden" }}
      onSubmit={(e) => {
        e.preventDefault();
      }}
    >
      <div className="p-ch">
        <h2 id="pf" className="p-h2">
          Profile
        </h2>
        <span className="p-sub">Everyone in Sevyn Labs sees this</span>
      </div>
      <div className="p-fr">
        <label htmlFor="nm">Name</label>
        <input
          id="nm"
          className="in"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="p-fr">
        <label htmlFor="tt">Title</label>
        <input
          id="tt"
          className="in"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="p-fr">
        <label htmlFor="pr">
          Pronouns <small>Optional</small>
        </label>
        <input
          id="pr"
          className="in"
          value={pronouns}
          onChange={(e) => setPronouns(e.target.value)}
        />
      </div>
      <div className="p-fr">
        <span className="lb">
          Work email <small>Set by your invitation</small>
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: "var(--ink-2)",
          }}
        >
          <span style={{ color: "var(--muted)", display: "inline-flex" }}>
            <IconLock width={13} height={13} strokeWidth={1.6} />
          </span>
          {email}
        </span>
      </div>
      <div className="p-fr">
        <label htmlFor="tz">Time zone</label>
        <select
          id="tz"
          className="in p-sel"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
        >
          <option>Eastern Time · Philadelphia</option>
          <option>Central Time</option>
          <option>Pacific Time</option>
        </select>
      </div>
      <div className="p-formfoot">
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
  return (
    <section
      className="card"
      aria-labelledby="nt"
      style={{ padding: "18px 18px 8px" }}
    >
      <h2 id="nt" className="p-panel" style={{ marginBottom: 8 }}>
        Email me when
      </h2>
      <label className="p-ck">
        <input type="checkbox" checked disabled />{" "}
        <span>
          My role or access changes{" "}
          <span className="always">· always on</span>
        </span>
      </label>
      <label className="p-ck">
        <input
          type="checkbox"
          checked={accepts}
          onChange={(e) => setAccepts(e.target.checked)}
        />{" "}
        <span>Someone accepts an invitation I sent</span>
      </label>
      <label className="p-ck">
        <input
          type="checkbox"
          checked={joins}
          onChange={(e) => setJoins(e.target.checked)}
        />{" "}
        <span>Someone joins a team I’m on</span>
      </label>
    </section>
  );
}
