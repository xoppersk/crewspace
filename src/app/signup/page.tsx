import type { Metadata } from "next";
import Link from "next/link";
import { getMember, getOrg, getPermissions } from "@/lib/api";
import { ButtonLink } from "@/components/Button";
import { GoogleMark } from "@/components/GoogleButton";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = { title: "Crewspace — Start a register" };

/** F-03 — Sign up, step 1 of 3: your organization. */
export default function SignUpPage() {
  const org = getOrg();
  const owner = getMember("001")!;
  const permissionCount = getPermissions().length;
  const groupCount = org.groups.length;

  return (
    <div className="pub">
      <header className="auth-head">
        <Link href="/" className="wordmark">
          Crewspace
        </Link>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          Already have one? <Link href="/signin">Sign in</Link>
        </span>
      </header>

      <div className="auth-grid">
        <form className="auth-form" style={{ maxWidth: 420 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>
            Step 1 of 3 · then invite people, then assign roles
          </span>
          <h1 className="public-title">
            Start your organization’s register
          </h1>

          <a
            href="#"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              height: 44,
              padding: "0 12px",
              border: "1px solid var(--seal)",
              boxShadow: "inset 0 0 0 1px var(--seal)",
              borderRadius: "var(--radius-m)",
              color: "var(--ink)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <GoogleMark />
            <span style={{ flex: 1, textAlign: "left" }}>{owner.email}</span>
            <span style={{ fontSize: 12, color: "var(--active)" }}>
              Verified
            </span>
          </a>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <label
              htmlFor="on"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Organization name
            </label>
            <input
              id="on"
              className="in"
              defaultValue={org.name}
              style={{ height: 44, width: "100%", fontSize: 15 }}
            />
          </div>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 6 }}
          >
            <label
              htmlFor="dm"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              Work domain
            </label>
            <input
              id="dm"
              className="in mono"
              value={org.domain}
              readOnly
              style={{
                height: 44,
                width: "100%",
                background: "var(--sheet-sunk)",
                fontSize: 14,
              }}
            />
            <span
              style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}
            >
              From your Google account. People on this domain can be invited
              as members; anyone else joins as a guest.
            </span>
          </div>

          <ButtonLink
            variant="pri"
            size="h44"
            href="/app/setup/invite"
            style={{ width: "100%" }}
          >
            Create {org.name}
          </ButtonLink>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              lineHeight: 1.5,
              color: "var(--muted)",
            }}
          >
            By continuing you agree to the <a href="#">terms</a> and{" "}
            <a href="#">privacy policy</a>.
          </p>
        </form>

        <aside className="auth-side" style={{ maxWidth: 360, paddingTop: 34 }}>
          <h2 className="panel" style={{ marginBottom: 8 }}>
            What you’ll have
          </h2>
          <div className="ll big">
            <span>You, as owner</span>
            <i />
            <span className="mono" style={{ fontSize: 13 }}>
              Member {owner.id}
            </span>
          </div>
          <div className="ll big">
            <span>Ready-made roles</span>
            <i />
            <span>Owner, Member, Guest</span>
          </div>
          <div className="ll big">
            <span>Permissions to set</span>
            <i />
            <span>
              {permissionCount}, in {groupCount} groups
            </span>
          </div>
          <div
            className="ll big"
            style={{ borderBottom: "1px solid var(--rule)" }}
          >
            <span>Audit log</span>
            <i />
            <span>from the first minute</span>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
