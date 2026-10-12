"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

export interface SettingsData {
  orgName: string;
  domain: string;
  domainVerified: string;
  defaultRoleOptions: { id: string; name: string; allows: number }[];
  guestCount: number;
  twoStepMissing: number;
  baseline: { allowsCount: number; permissionName: string; inheritCount: number; customRoles: number };
  productAdmins: { id: string; name: string }[];
}

const inputStyle: React.CSSProperties = { maxWidth: 360, width: "100%" };
const radioStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  padding: "5px 0",
  fontSize: 14,
  lineHeight: 1.45,
};
const tabBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  height: 40,
  padding: "0 2px",
  borderBottom: "2px solid transparent",
  color: "var(--ink-2)",
  textDecoration: "none",
  fontSize: 14,
};

function SheetHead({ id, title, extra }: { id: string; title: string; extra?: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "16px 24px 12px",
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 8,
      }}
    >
      <h2 id={id} className="section">
        {title}
      </h2>
      {extra}
    </div>
  );
}

/**
 * G-04 organization settings. The session-length field starts in the
 * designed unsaved state (14 days saved, 7 days chosen): the row tints,
 * shows "Changed · was 14 days" with its consequence, and the header
 * counts 1 unsaved change. Editing back, Discard and Save all clear it;
 * while dirty, leaving the page warns via beforeunload (brief §10).
 */
export function SettingsClient({ data }: { data: SettingsData }) {
  const [savedSession, setSavedSession] = useState("14 days");
  const [session, setSession] = useState("7 days");
  const dirty = session !== savedSession;
  const unsavedCount = dirty ? 1 : 0;

  const [newOwnerId, setNewOwnerId] = useState(data.productAdmins[0]?.id ?? "");
  const newOwner = data.productAdmins.find((m) => m.id === newOwnerId);
  const ownerFirst = newOwner?.name.split(" ")[0] ?? "";

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  return (
    <>
      <div className="page-head" style={{ paddingTop: 22 }}>
        <div className="stack">
          <h1 className="title">Settings</h1>
          <span style={{ fontSize: 14, color: "var(--ink-2)" }}>
            Rules that apply to everyone in {data.orgName}. Only the owner can
            change them; every change is in the audit log.
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty ? (
            <span role="status" style={{ fontSize: 13, fontWeight: 600, color: "var(--pending)" }}>
              {unsavedCount} unsaved change
            </span>
          ) : null}
          <Button onClick={() => setSession(savedSession)} disabled={!dirty}>
            Discard
          </Button>
          <Button variant="pri" onClick={() => setSavedSession(session)} disabled={!dirty}>
            Save
          </Button>
        </div>
      </div>

      <nav
        aria-label="Settings sections"
        style={{ display: "flex", gap: 24, borderBottom: "1px solid var(--frame)" }}
      >
        <Link
          href="/app/settings"
          aria-current="page"
          style={{ ...tabBase, color: "var(--ink)", fontWeight: 600, borderBottomColor: "var(--seal)" }}
        >
          Organization
        </Link>
        <Link href="/app/settings/billing" style={tabBase}>
          Plan and billing
        </Link>
      </nav>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 920 }}>
        <section className="sheet" aria-labelledby="h1s">
          <SheetHead id="h1s" title="Identity" />
          <Field label="Organization name" htmlFor="on">
            <input id="on" className="in h38" style={inputStyle} defaultValue={data.orgName} />
          </Field>
          <Field label="Work domain" help="Addresses on it can be invited as members.">
            <span className="mono" style={{ fontSize: 13 }}>
              {data.domain}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--active)" }}>
              Verified {data.domainVerified}
            </span>
            <a href="#" style={{ fontSize: 13 }}>
              Add a domain
            </a>
          </Field>
          <Field label="Role for new members" help="Used when an invitation doesn’t name one." htmlFor="dr">
            <select id="dr" className="in h38" style={inputStyle} defaultValue="member">
              {data.defaultRoleOptions.map((r, i) => (
                <option key={r.id} value={r.id}>
                  {i === 0 ? `${r.name} · allows ${r.allows} of 18` : r.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Guests" help={`People outside ${data.domain}.`}>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <label style={radioStyle}>
                <input type="radio" name="g" defaultChecked style={{ accentColor: "var(--seal)", width: 16, height: 16, marginTop: 3 }} />
                <span>
                  Allowed, on the teams they’re added to only{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {data.guestCount} guest now
                  </span>
                </span>
              </label>
              <label style={radioStyle}>
                <input type="radio" name="g" style={{ accentColor: "var(--seal)", width: 16, height: 16, marginTop: 3 }} />
                <span>Not allowed</span>
              </label>
            </span>
          </Field>
        </section>

        <section className="sheet" aria-labelledby="h2s">
          <SheetHead id="h2s" title="Sign-in" />
          <Field label="Methods">
            <span style={{ fontSize: 14 }}>
              Google accounts on {data.domain} ·{" "}
              <span style={{ color: "var(--muted)" }}>guests use an email link</span>
            </span>
          </Field>
          <Field label="2-step verification">
            <span style={{ display: "flex", flexDirection: "column" }}>
              <label style={radioStyle}>
                <input type="radio" name="tf" style={{ accentColor: "var(--seal)", width: 16, height: 16, marginTop: 3 }} />
                <span>Optional</span>
              </label>
              <label style={radioStyle}>
                <input type="radio" name="tf" defaultChecked style={{ accentColor: "var(--seal)", width: 16, height: 16, marginTop: 3 }} />
                <span>
                  Required from <b style={{ fontWeight: 600 }}>November 1</b>{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {data.twoStepMissing} people aren’t set up yet
                  </span>
                </span>
              </label>
            </span>
          </Field>
          <Field
            label="Stay signed in for"
            htmlFor="sl"
            changed={dirty ? { was: savedSession } : undefined}
            consequence={
              dirty
                ? `After saving, sessions older than ${session.replace(" days", "")} days end at next page load. That signs out 6 people today.`
                : undefined
            }
          >
            <select
              id="sl"
              className="in h38"
              style={{ ...inputStyle, ...(dirty ? { borderColor: "var(--seal)" } : {}) }}
              value={session}
              onChange={(e) => setSession(e.target.value)}
              aria-label="Stay signed in for"
            >
              <option>7 days</option>
              <option>14 days</option>
              <option>30 days</option>
            </select>
          </Field>
        </section>

        <section className="sheet" aria-labelledby="h3s">
          <SheetHead id="h3s" title="Access defaults" />
          <Field
            label="Organization baseline"
            help="What “Inherit” means in every custom role."
          >
            <span style={{ fontSize: 14, lineHeight: 1.5 }}>
              Allows {data.baseline.allowsCount} of 18: {data.baseline.permissionName}.{" "}
              {data.baseline.inheritCount} settings across {data.baseline.customRoles} roles
              inherit it. <Link href="/app/roles">Change in Roles</Link>
            </span>
          </Field>
          <Field label="Audit log kept for" htmlFor="ar">
            <select id="ar" className="in h38" style={inputStyle} defaultValue="2 years">
              <option>2 years</option>
              <option>1 year</option>
              <option>7 years</option>
            </select>
          </Field>
        </section>

        <section
          className="sheet"
          aria-labelledby="h4s"
          style={{ borderColor: "var(--deny-line)" }}
        >
          <SheetHead
            id="h4s"
            title="Transfer ownership"
            extra={<span style={{ fontSize: 13, color: "var(--muted)" }}>Owner only</span>}
          />
          <div
            style={{
              padding: "4px 24px 20px",
              display: "grid",
              gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
              gap: 20,
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label htmlFor="to" style={{ fontWeight: 600, fontSize: 14 }}>
                New owner
              </label>
              <select
                id="to"
                className="in h38"
                style={{ width: "100%" }}
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
              >
                {data.productAdmins.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · Product admin · {m.id}
                  </option>
                ))}
              </select>
              <span className="caption">
                Only Product admins with 2-step on can be chosen.
              </span>
            </div>
            <ol
              style={{
                margin: 0,
                padding: "0 0 0 18px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              <li>You confirm with Google sign-in again.</li>
              <li>{ownerFirst} accepts by email within 48 hours.</li>
              <li>He becomes Organization owner; you become Product admin.</li>
            </ol>
          </div>
          <div
            style={{
              padding: "14px 24px",
              borderTop: "1px solid var(--rule)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button variant="dest">Start transfer</Button>
          </div>
        </section>
      </div>
    </>
  );
}
