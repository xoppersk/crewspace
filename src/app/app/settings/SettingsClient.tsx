"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { transferOwnership, updateOrgSettings } from "@/lib/data/actions";
import { Button } from "@/components/Button";
import { Field } from "@/components/Field";

export interface SettingsData {
  orgName: string;
  domain: string;
  domainVerified: string;
  defaultRoleId: string;
  defaultRoleOptions: { id: string; name: string; allows: number }[];
  /** Dollars; stored in the DB as seat_price_cents. */
  seatPrice: number;
  /** organizations.session_timeout_minutes. */
  sessionMinutes: number;
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

const SESSION_OPTIONS = [
  { minutes: 10080, label: "7 days" },
  { minutes: 20160, label: "14 days" },
  { minutes: 43200, label: "30 days" },
];

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

interface FormState {
  orgName: string;
  domain: string;
  defaultRoleId: string;
  seatPrice: string;
  sessionMinutes: number;
}

/**
 * G-04 organization settings — real reads/writes against the
 * organizations row through updateOrgSettings (name, work domain,
 * default role, per-seat price, session timeout). The header Save /
 * Discard pair tracks every editable field; saving is
 * permission-checked server-side and audit-logged. Sections with no
 * storage in the schema (guest policy, 2-step enforcement date, audit
 * retention) render disabled rather than pretending to save.
 * Ownership transfer calls the transfer_org_ownership RPC.
 */
export function SettingsClient({ data }: { data: SettingsData }) {
  const router = useRouter();
  const initial: FormState = {
    orgName: data.orgName,
    domain: data.domain,
    defaultRoleId: data.defaultRoleId,
    seatPrice: String(data.seatPrice),
    sessionMinutes: data.sessionMinutes,
  };
  const [saved, setSaved] = useState<FormState>(initial);
  const [form, setForm] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const changedFields = (Object.keys(form) as (keyof FormState)[]).filter(
    (k) => form[k] !== saved[k],
  );
  const dirty = changedFields.length > 0;
  const sessionChanged = form.sessionMinutes !== saved.sessionMinutes;
  const savedSessionLabel =
    SESSION_OPTIONS.find((o) => o.minutes === saved.sessionMinutes)?.label ??
    `${Math.round(saved.sessionMinutes / 1440)} days`;
  const sessionLabel =
    SESSION_OPTIONS.find((o) => o.minutes === form.sessionMinutes)?.label ??
    `${Math.round(form.sessionMinutes / 1440)} days`;

  const [newOwnerId, setNewOwnerId] = useState(data.productAdmins[0]?.id ?? "");
  const newOwner = data.productAdmins.find((m) => m.id === newOwnerId);
  const ownerFirst = newOwner?.name.split(" ")[0] ?? "";
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferNote, setTransferNote] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  async function save() {
    setBusy(true);
    setNote(null);
    const res = await updateOrgSettings({
      name: form.orgName !== saved.orgName ? form.orgName : undefined,
      domain: form.domain !== saved.domain ? form.domain : undefined,
      defaultRoleUiId:
        form.defaultRoleId !== saved.defaultRoleId
          ? form.defaultRoleId
          : undefined,
      pricePerSeat:
        form.seatPrice !== saved.seatPrice
          ? Number(form.seatPrice)
          : undefined,
      sessionTimeoutMinutes: sessionChanged ? form.sessionMinutes : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setNote(res.error);
      return;
    }
    setSaved(form);
    setNote("Saved. The change is in the audit log.");
    router.refresh();
  }

  async function startTransfer() {
    if (!newOwnerId) return;
    if (
      !window.confirm(
        `Transfer ownership to ${newOwner?.name ?? "this member"}? This moves ownership immediately.`,
      )
    ) {
      return;
    }
    setTransferBusy(true);
    setTransferNote(null);
    const res = await transferOwnership(newOwnerId);
    setTransferBusy(false);
    if (!res.ok) {
      setTransferNote(res.error);
      return;
    }
    setTransferNote("Ownership transferred.");
    router.refresh();
  }

  return (
    <>
      <div className="gov-head">
        <div className="stack">
          <h1 className="gov-title">Settings</h1>
          <p className="gov-lede">
            Rules that apply to everyone in {data.orgName}. Only people
            with the settings permission can change them; every change is
            in the audit log.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {dirty ? (
            <span
              role="status"
              className="gov-st pe"
              style={{ fontSize: 13, marginRight: 6 }}
            >
              {changedFields.length} unsaved change
              {changedFields.length === 1 ? "" : "s"}
            </span>
          ) : null}
          <Button onClick={() => setForm(saved)} disabled={!dirty || busy}>
            Discard
          </Button>
          <Button
            variant="pri"
            onClick={() => void save()}
            disabled={!dirty || busy}
          >
            Save
          </Button>
        </div>
      </div>
      {note ? (
        <p role="status" style={{ fontSize: 13.5, margin: "0 0 12px" }}>
          {note}
        </p>
      ) : null}

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
              value={form.orgName}
              onChange={(e) => setForm({ ...form, orgName: e.target.value })}
            />
          </Field>
          <Field
            label="Work domain"
            help="Addresses on it can be invited as members."
            htmlFor="wd"
          >
            <input
              id="wd"
              className="in h38"
              style={inputStyle}
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
            />
            {data.domainVerified ? (
              <span className="gov-st ok">Verified {data.domainVerified}</span>
            ) : null}
          </Field>
          <Field
            label="Role for new members"
            help="Used when an invitation doesn’t name one."
            htmlFor="dr"
          >
            <select
              id="dr"
              className="in h38"
              style={inputStyle}
              value={form.defaultRoleId}
              onChange={(e) =>
                setForm({ ...form, defaultRoleId: e.target.value })
              }
            >
              {data.defaultRoleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · allows {r.allows} of 18
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Price per seat"
            help="Charged per member per month; billing reads this value."
            htmlFor="ps"
          >
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span aria-hidden="true">$</span>
              <input
                id="ps"
                className="in h38"
                style={{ maxWidth: 120 }}
                type="number"
                min={0}
                step="0.01"
                value={form.seatPrice}
                onChange={(e) =>
                  setForm({ ...form, seatPrice: e.target.value })
                }
              />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                a month
              </span>
            </span>
          </Field>
          <Field label="Guests" help={`People outside ${data.domain}.`}>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <label className="gov-rd">
                <input type="radio" name="g" defaultChecked disabled />
                <span>
                  Allowed, on the teams they’re added to only{" "}
                  <span style={{ color: "var(--muted)" }}>
                    · {data.guestCount} guest{data.guestCount === 1 ? "" : "s"} now
                  </span>
                </span>
              </label>
              <label className="gov-rd">
                <input type="radio" name="g" disabled />
                <span>Not allowed</span>
              </label>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Guest policy is fixed for now.
              </span>
            </span>
          </Field>
        </section>

        <section className="card" aria-labelledby="h2s" style={{ overflow: "hidden" }}>
          <SectionHead id="h2s" title="Sign-in" icon={SignInIcon} />
          <Field label="Methods">
            <span style={{ fontSize: 14 }}>
              Email and password, or Google, on {data.domain} ·{" "}
              <span style={{ color: "var(--muted)" }}>
                guests sign in with the same methods
              </span>
            </span>
          </Field>
          <Field label="2-step verification">
            <span style={{ display: "flex", flexDirection: "column" }}>
              <label className="gov-rd">
                <input type="radio" name="tf" defaultChecked disabled />
                <span>
                  Set by each person in their account
                  {data.twoStepMissing > 0 ? (
                    <span style={{ color: "var(--muted)" }}>
                      {" "}
                      · {data.twoStepMissing} people aren’t set up yet
                    </span>
                  ) : null}
                </span>
              </label>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Organization-wide enforcement isn’t configurable yet.
              </span>
            </span>
          </Field>
          <Field
            label="Stay signed in for"
            htmlFor="sl"
            changed={sessionChanged ? { was: savedSessionLabel } : undefined}
            consequence={
              sessionChanged
                ? `After saving, sessions older than ${sessionLabel.replace(" days", "")} days end at next page load.`
                : undefined
            }
          >
            <select
              id="sl"
              className="in h38"
              style={{ ...inputStyle, ...(sessionChanged ? { borderColor: "var(--seal)" } : {}) }}
              value={form.sessionMinutes}
              onChange={(e) =>
                setForm({ ...form, sessionMinutes: Number(e.target.value) })
              }
            >
              {SESSION_OPTIONS.map((o) => (
                <option key={o.minutes} value={o.minutes}>
                  {o.label}
                </option>
              ))}
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
            <select id="ar" className="in h38" style={inputStyle} defaultValue="2 years" disabled>
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
                    {m.name} · Product admin
                  </option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>
                Only Product admins can be chosen.
              </span>
              {transferNote ? (
                <span role="status" style={{ fontSize: 12.5 }}>
                  {transferNote}
                </span>
              ) : null}
            </div>
            <ol className="gov-steps-num">
              <li>
                <span className="n">1</span>
                <span>You choose the new owner and confirm.</span>
              </li>
              <li>
                <span className="n">2</span>
                <span>Ownership moves to {ownerFirst || "them"} immediately and is written to the audit log.</span>
              </li>
              <li>
                <span className="n">3</span>
                <span>You become Product admin.</span>
              </li>
            </ol>
          </div>
          <div className="gov-transfer-foot">
            <Button
              variant="dest"
              className="gov-dng"
              disabled={transferBusy || !newOwnerId}
              onClick={() => void startTransfer()}
            >
              Start transfer
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
