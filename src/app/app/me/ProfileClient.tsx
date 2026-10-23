"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateMyProfile } from "@/lib/data/actions";
import { Button } from "@/components/Button";
import { IconLock } from "@/components/icons";

/* P-05 interactive parts. The profile form writes the real profile
   (profiles.full_name / title / timezone) through a server action.
   Email preferences have no backend storage yet, so they persist on
   this device only (localStorage) and are labelled as such. */

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Africa/Freetown",
];

export function ProfileForm({
  initialName,
  initialTitle,
  initialTimezone,
  email,
  orgName,
}: {
  initialName: string;
  initialTitle: string;
  initialTimezone: string;
  email: string;
  orgName: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [tz, setTz] = useState(initialTimezone);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  return (
    <form
      className="card"
      aria-labelledby="pf"
      style={{ overflow: "hidden" }}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setNote(null);
        const res = await updateMyProfile({
          fullName: name,
          title,
          timezone: tz,
        });
        setBusy(false);
        if (res.ok) {
          setNote("Profile saved.");
          router.refresh();
        } else {
          setNote(res.error);
        }
      }}
    >
      <div className="p-ch">
        <h2 id="pf" className="p-h2">
          Profile
        </h2>
        <span className="p-sub">Everyone in {orgName} sees this</span>
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
          {[...new Set([initialTimezone, ...TIMEZONES])].map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </select>
      </div>
      <div className="p-formfoot">
        <Button variant="pri" type="submit" disabled={busy}>
          Save profile
        </Button>
        {note ? (
          <span style={{ fontSize: 13, color: "var(--ink-2)" }}>{note}</span>
        ) : null}
      </div>
    </form>
  );
}

export function EmailSettings() {
  const [accepts, setAccepts] = useState(true);
  const [joins, setJoins] = useState(false);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("crewspace-email-prefs");
      if (raw) {
        const parsed = JSON.parse(raw) as { accepts?: boolean; joins?: boolean };
        if (typeof parsed.accepts === "boolean") setAccepts(parsed.accepts);
        if (typeof parsed.joins === "boolean") setJoins(parsed.joins);
      }
    } catch {
      // Private mode etc. — preferences simply don't persist.
    }
  }, []);
  const save = (next: { accepts: boolean; joins: boolean }) => {
    try {
      window.localStorage.setItem(
        "crewspace-email-prefs",
        JSON.stringify(next),
      );
    } catch {
      // See above.
    }
  };
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
          onChange={(e) => {
            setAccepts(e.target.checked);
            save({ accepts: e.target.checked, joins });
          }}
        />{" "}
        <span>Someone accepts an invitation I sent</span>
      </label>
      <label className="p-ck">
        <input
          type="checkbox"
          checked={joins}
          onChange={(e) => {
            setJoins(e.target.checked);
            save({ accepts, joins: e.target.checked });
          }}
        />{" "}
        <span>Someone joins a team I’m on</span>
      </label>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: "4px 0 10px" }}>
        These two preferences are stored on this device for now.
      </p>
    </section>
  );
}

/** Real data export: downloads the signed-in user's own record as JSON. */
export function DownloadMyData({
  record,
}: {
  record: Record<string, unknown>;
}) {
  return (
    <button
      type="button"
      onClick={() => {
        const blob = new Blob([JSON.stringify(record, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "crewspace-my-record.json";
        a.click();
        URL.revokeObjectURL(url);
      }}
      style={{
        display: "inline-flex",
        gap: 8,
        alignItems: "center",
        padding: "0 4px",
        fontSize: 13,
        fontWeight: 600,
        background: "none",
        border: 0,
        cursor: "pointer",
        color: "var(--ink)",
        textAlign: "left",
      }}
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2" />
        <path d="M2.5 12.5h11" />
      </svg>
      Download what Crewspace stores about you
    </button>
  );
}
