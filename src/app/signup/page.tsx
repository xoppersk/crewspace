import type { Metadata } from "next";
import Link from "next/link";
import { getMember, getOrg, getPermissions } from "@/lib/api";
import { ButtonLink } from "@/components/Button";
import { GoogleMark } from "@/components/GoogleButton";
import { IconCheck, IconShieldCheck } from "@/components/icons";
import { LegalFooter } from "@/components/LegalFooter";

export const metadata: Metadata = { title: "Crewspace — Start a register" };

/** F-03 — Sign up, step 1 of 3: verified Google account, organization
    name, work domain; dark side panel "What you'll have" (SignUp.html). */
export default function SignUpPage() {
  const org = getOrg();
  const owner = getMember("001")!;
  const permissionCount = getPermissions().length;
  const groupCount = org.groups.length;

  return (
    <div className="pub fpub">
      <header className="auth-head">
        <Link href="/" className="fm-word">
          <span className="shieldmark" aria-hidden="true">
            <IconShieldCheck />
          </span>
          <span className="fm-name">Crewspace</span>
        </Link>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          Already have one?{" "}
          <Link href="/signin" style={{ fontWeight: 600 }}>
            Sign in
          </Link>
        </span>
      </header>

      <div className="auth-grid">
        <form
          className="auth-form fa-form-lg"
          style={{ flex: "1 1 400px", maxWidth: 480 }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            <div className="fprog" aria-hidden="true">
              <i className="on" />
              <i />
              <i />
            </div>
            <span style={{ fontSize: 13, color: "var(--muted)" }}>
              Step 1 of 3 · then invite people, then assign roles
            </span>
          </div>
          <h1 className="ft-34">Start your organization’s register</h1>

          <a
            href="#"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 46,
              padding: "0 14px",
              border: "1px solid var(--seal)",
              boxShadow: "inset 0 0 0 1px var(--seal)",
              borderRadius: "var(--radius-m)",
              background: "var(--row-tint-allow)",
              color: "var(--ink)",
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            <GoogleMark />
            <span style={{ flex: 1, textAlign: "left" }}>{owner.email}</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                fontWeight: 400,
                color: "var(--active)",
              }}
            >
              <IconCheck width={12} height={12} />
              Verified
            </span>
          </a>

          <div
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
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
            style={{ display: "flex", flexDirection: "column", gap: 7 }}
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
              style={{
                fontSize: 12.5,
                lineHeight: 1.5,
                color: "var(--muted)",
              }}
            >
              From your Google account. People on this domain can be invited
              as members; anyone else joins as a guest.
            </span>
          </div>

          <ButtonLink
            variant="pri"
            href="/app/setup/invite"
            style={{ width: "100%", height: 46, fontSize: 14 }}
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

        <aside
          className="fdark"
          style={{
            alignSelf: "flex-start",
            flex: "1 1 340px",
            maxWidth: 400,
            padding: 28,
            gap: 18,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              aria-hidden="true"
              style={{
                width: 40,
                height: 40,
                borderRadius: "var(--radius-l)",
                background: "#fff",
                color: "var(--ink)",
                display: "grid",
                placeItems: "center",
                flex: "none",
                font: "800 15px/1 var(--font-sans)",
              }}
            >
              SL
            </span>
            <span
              style={{ display: "flex", flexDirection: "column", gap: 4 }}
            >
              <b style={{ font: "700 17px/1.1 var(--font-sans)" }}>
                {org.name}
              </b>
              <span
                className="mono"
                style={{ fontSize: 12, color: "var(--panel-muted)" }}
              >
                {org.domain}
              </span>
            </span>
          </div>
          <div>
            <h2
              style={{
                margin: "0 0 6px",
                font: "700 15px/1.3 var(--font-sans)",
              }}
            >
              What you’ll have
            </h2>
            <div className="fdk">
              <span>You, as owner</span>
              <span className="mono" style={{ fontSize: 13 }}>
                Member {owner.id}
              </span>
            </div>
            <div className="fdk">
              <span>Ready-made roles</span>
              <span>Owner, Member, Guest</span>
            </div>
            <div className="fdk">
              <span>Permissions to set</span>
              <span>
                {permissionCount}, in {groupCount} groups
              </span>
            </div>
            <div className="fdk last">
              <span>Audit log</span>
              <span>from the first minute</span>
            </div>
          </div>
          <div className="fpanel-card" style={{ padding: 14 }}>
            <div
              className="fgroupstrip"
              role="img"
              aria-label="18 permissions in 8 groups, none set yet"
            >
              {org.groups.map((g) => (
                <span
                  key={g.name}
                  className="fg"
                  style={{
                    gridTemplateColumns: `repeat(${g.permissionIds.length}, minmax(0, 1fr))`,
                    flex: `${g.permissionIds.length} 1 0`,
                  }}
                >
                  {g.permissionIds.map((id) => (
                    <i key={id} />
                  ))}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <LegalFooter />
    </div>
  );
}
