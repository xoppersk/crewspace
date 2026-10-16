"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

export interface SettingsData {
  orgName: string;
  domain: string;
  domainVerified: string;
  defaultRoleOptions: { id: string; name: string; allows: number }[];
  guestCount: number;
  twoStepMissing: number;
  baseline: {
    allowsCount: number;
    permissionId: number;
    permissionName: string;
    inheritCount: number;
    customRoles: number;
  };
  productAdmins: { id: string; name: string }[];
}

const inputStyle: React.CSSProperties = { maxWidth: 380, width: "100%" };

function SectionHead({
  id,
  title,
  icon,
  deny = false,
  extra,
}: {
  id: string;
  title: string;
  icon: ReactNode;
  deny?: boolean;
  extra?: ReactNode;
}) {
  return (
    <div className="gov-sheet-head">
      <span className={`gov-ico32${deny ? " deny" : ""}`} aria-hidden="true">
        {icon}
      </span>
      <h2 id={id}>{title}</h2>
      {extra ? <span className="spacer">{extra}</span> : null}
    </div>
  );
}

const iconProps = {
  width: 15,
  height: 15,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  "aria-hidden": true,
} as const;

const IdentityIcon = (
  <svg {...iconProps}>
    <rect x="2" y="2" width="5" height="5" rx="1" />
    <rect x="9" y="2" width="5" height="5" rx="1" />
    <rect x="2" y="9" width="5" height="5" rx="1" />
    <rect x="9" y="9" width="5" height="5" rx="1" />
  </svg>
);
const SignInIcon = (
  <svg {...iconProps}>
    <circle cx="5.5" cy="10.5" r="2.8" />
    <path d="m7.5 8.5 6-6M11.5 4.5l1.8 1.8" />
  </svg>
);
const ShieldIcon = (
  <svg {...iconProps}>
    <path d="M8 1.8 13.5 4v4c0 3.2-2.4 5.4-5.5 6.2C4.9 13.4 2.5 11.2 2.5 8V4z" />
    <path d="m5.6 8 1.7 1.7L10.6 6.4" />
  </svg>
);
const WarnIcon = (
  <svg {...iconProps}>
    <path d="M8 2.2 14.2 13H1.8z" />
    <path d="M8 6.5v3M8 11.2v.1" />
  </svg>
);

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
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Settings</h1>
          <p className="gov-lede">
            Rules that apply to everyone in {data.orgName}. Only the owner can
            change them; every change is in the audit log.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty ? (
            <span
              role="status"
              className="gov-st pe"
              style={{ fontSize: 13, marginRight: 6 }}
            >
              {unsavedCount} unsaved change
            </span>
          ) : null}
          <Button onClick={() => setSession(savedSession)} disabled={!dirty}>
            Discard
          </Button>
          <Button
            variant="pri"
            onClick={() => setSavedSession(session)}
            disabled={!dirty}
          >
            Save
          </Button>
        </div>
      </div>

      <nav aria-label="Settings sections" className="gov-tabs">
        <Link href="/app/settings" aria-current="page">
          Organization
        </Link>
        <Link href="/app/settings/billing">Plan and billing</Link>
      </nav>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 940,
        }}
      >
        <section className="card" aria-labelledby="h1s" style={{ overflow: "hidden" }}>
          <SectionHead id="h1s" title="Identity" icon={IdentityIcon} />
          <Field label="Organization name" htmlFor="on">
            <input
              id="on"
              className="in h38"
              style={inputStyle}
              defaultValue={data.orgName}
            />
          </Field>
          <Field
            label="Work domain"
            help="Addresses on it can be invited as members."
          >
            <span
              className="gov-rno"
              style={{ fontSize: 13, height: 26 }}
            >
              {data.domain}
            </span>
            <span className="gov-st ok">Verified {data.domainVerified}</span>
            <a href="#" style={{ fontSize: 13, fontWeight: 600 }}>
              Add a domain
            </a>
          </Field>
          <Field
            label="Role for new members"
            help="Used when an invitation doesn’t name one."
            htmlFor="dr"
          >
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
              <label className="gov-rd">
                <input type="radio" name="g" defaultChecked />
                <span>
                  Allowed, on the teams they’re added to only{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {data.guestCount} guest now
                  </span>
                </span>
              </label>
              <label className="gov-rd">
                <input type="radio" name="g" />
                <span>Not allowed</span>
              </label>
            </span>
          </Field>
        </section>

        <section className="card" aria-labelledby="h2s" style={{ overflow: "hidden" }}>
          <SectionHead id="h2s" title="Sign-in" icon={SignInIcon} />
          <Field label="Methods">
            <span style={{ fontSize: 14 }}>
              Google accounts on {data.domain} ·{" "}
              <span style={{ color: "var(--muted)" }}>guests use an email link</span>
            </span>
          </Field>
          <Field label="2-step verification">
            <span style={{ display: "flex", flexDirection: "column" }}>
              <label className="gov-rd">
                <input type="radio" name="tf" />
                <span>Optional</span>
              </label>
              <label className="gov-rd">
                <input type="radio" name="tf" defaultChecked />
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
            >
              <option>7 days</option>
              <option>14 days</option>
              <option>30 days</option>
            </select>
          </Field>
        </section>

        <section className="card" aria-labelledby="h3s" style={{ overflow: "hidden" }}>
          <SectionHead id="h3s" title="Access defaults" icon={ShieldIcon} />
          <Field
            label="Organization baseline"
            help="What “Inherit” means in every custom role."
          >
            <span
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                fontSize: 14,
                lineHeight: 1.5,
              }}
            >
              <span>
                Allows {data.baseline.allowsCount} of 18:{" "}
                {data.baseline.permissionName}. {data.baseline.inheritCount}{" "}
                settings across {data.baseline.customRoles} roles inherit it.{" "}
                <Link href="/app/roles">Change in Roles</Link>
              </span>
              <span
                className="gov-strip18"
                role="img"
                aria-label={`Baseline allows permission ${data.baseline.permissionId} of 18`}
              >
                {Array.from({ length: 18 }, (_, i) => (
                  <i
                    key={i}
                    className={i + 1 === data.baseline.permissionId ? "on" : undefined}
                  />
                ))}
              </span>
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
          className="card gov-transfer"
          aria-labelledby="h4s"
          style={{ overflow: "hidden" }}
        >
          <SectionHead
            id="h4s"
            title="Transfer ownership"
            icon={WarnIcon}
            deny
            extra={<span className="gov-chip deny">Owner only</span>}
          />
          <div className="gov-transfer-body">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label htmlFor="to" style={{ fontWeight: 600, fontSize: 13.5 }}>
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
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Only Product admins with 2-step on can be chosen.
              </span>
            </div>
            <ol className="gov-steps-num">
              <li>
                <span className="n">1</span>
                <span>You confirm with Google sign-in again.</span>
              </li>
              <li>
                <span className="n">2</span>
                <span>{ownerFirst} accepts by email within 48 hours.</span>
              </li>
              <li>
                <span className="n">3</span>
                <span>He becomes Organization owner; you become Product admin.</span>
              </li>
            </ol>
          </div>
          <div className="gov-transfer-foot">
            <Button variant="dest" className="gov-dng">
              Start transfer
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
