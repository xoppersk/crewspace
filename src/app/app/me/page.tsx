import Link from "next/link";
import type { Metadata } from "next";
import {
  getInvitations,
  getMember,
  getRole,
  getTeam,
  memberEffectivePermissions,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { Button } from "@/components/Button";
import { EmailSettings, ProfileForm } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Crewspace — Your profile and access",
};

/* P-05 Profile — screens/Profile.html. Maya Jordan's own view (042).
   The "You can / You can't" lists are plain-word phrases keyed by
   permission id, filtered by memberEffectivePermissions(042), so they
   always agree with the register. */

const MONTHS: Record<string, string> = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
};

function longDate(short: string): string {
  const [mon, day] = short.split(" ");
  return `${MONTHS[mon ?? ""] ?? mon} ${day}`;
}

function deviceLabel(device: string): string {
  const [machine, browser] = device.split(" · ");
  if (!browser) return device;
  if (machine === "MacBook Pro") return `${browser} on Mac`;
  return `${browser} on ${machine}`;
}

function placeLabel(place: string): string {
  return place.replace(/, US$/, "");
}

export default function ProfilePage() {
  const me = getMember("042")!;
  const role = getRole(me.roleId)!;
  const effective = memberEffectivePermissions(me);
  const allowed = new Set(
    effective.filter((e) => e.result === "Allowed").map((e) => e.permission.id),
  );
  const blocked = new Set(
    effective.filter((e) => e.result === "Blocked").map((e) => e.permission.id),
  );

  const team = me.teams[0] ? getTeam(me.teams[0].teamId) : undefined;
  const lead = team?.leadId ? getMember(team.leadId) : undefined;
  const invitation = getInvitations().find((i) => i.email === me.email);
  const giver = invitation ? getMember(invitation.invitedById) : undefined;
  const owner = getMember("001")!;

  const can: { ids: number[]; text: string }[] = [
    { ids: [1], text: "Invite people and pick their first role" },
    { ids: [4], text: "Move people between roles, up to Product admin" },
    { ids: [3], text: "Edit anyone’s name, title and team" },
    { ids: [7, 8], text: "Create teams and change who’s on them" },
    { ids: [9], text: "Resend or cancel invitations" },
    { ids: [13], text: "Read the audit log" },
  ].filter((row) => row.ids.some((id) => allowed.has(id)));

  const cant: { ids: number[]; text: string }[] = [
    { ids: [2, 12], text: "Deactivate anyone or sign them out" },
    { ids: [5, 6], text: "Change what a role allows, or create roles" },
    { ids: [10], text: "Import people from a file" },
    {
      ids: [11, 15, 16, 17],
      text: "Change sign-in rules, billing or organization settings",
    },
    { ids: [14], text: "Export the audit archive" },
  ].filter((row) => row.ids.some((id) => blocked.has(id)));

  const listStyle: React.CSSProperties = {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 14,
    lineHeight: 1.45,
  };

  return (
    <AppShell current="none" navVariant="profile" personId="042">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 22 }}>
        <span className="register">Member {me.id}</span>
        <h1 className="title">Your profile and access</h1>
      </div>

      <div className="cols">
        <div
          style={{
            flex: "999 1 600px",
            minWidth: 0,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <section className="sheet" aria-labelledby="ya">
            <div
              style={{
                padding: "18px 24px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <h2 id="ya" className="section">
                What you can do here
              </h2>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--ink-2)",
                }}
              >
                You’re a{" "}
                <b style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {role.name}
                </b>{" "}
                on the {team?.name} team.
                {giver && invitation?.acceptedOn ? (
                  <>
                    {" "}
                    {giver.name} gave you this role on{" "}
                    {longDate(invitation.acceptedOn)}.
                  </>
                ) : null}
              </p>
            </div>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                borderTop: "1px solid var(--rule-strong)",
              }}
            >
              <div
                style={{
                  flex: "1 1 260px",
                  padding: "16px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    font: "600 13px/1.2 var(--font-sans)",
                  }}
                >
                  You can
                </h3>
                <ul style={listStyle}>
                  {can.map((row) => (
                    <li key={row.text}>{row.text}</li>
                  ))}
                </ul>
              </div>
              <div
                style={{
                  flex: "1 1 260px",
                  padding: "16px 24px",
                  borderLeft: "1px solid var(--rule)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <h3
                  style={{
                    margin: 0,
                    font: "600 13px/1.2 var(--font-sans)",
                    color: "var(--ink-2)",
                  }}
                >
                  You can’t
                </h3>
                <ul style={{ ...listStyle, color: "var(--ink-2)" }}>
                  {cant.map((row) => (
                    <li key={row.text}>{row.text}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div
              style={{
                padding: "14px 24px",
                borderTop: "1px solid var(--rule-strong)",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                fontSize: 13,
                lineHeight: 1.5,
                color: "var(--ink-2)",
              }}
            >
              <span>
                Need something on the right? Ask {owner.name}, the owner.
                {lead ? ` ${lead.name}, your team lead, is copied.` : ""}
              </span>
              <Button>Ask for access</Button>
            </div>
          </section>

          <ProfileForm
            initialName={me.name}
            initialTitle="Product designer"
            email={me.email}
          />
        </div>

        <aside className="side-col">
          <section
            className="sheet"
            aria-labelledby="se"
            style={{ padding: "18px 20px 10px" }}
          >
            <h2 id="se" className="panel" style={{ marginBottom: 6 }}>
              Where you’re signed in
            </h2>
            <div>
              {(me.sessions ?? []).map((s) => (
                <div
                  key={s.device}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) auto",
                    gap: 10,
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: "1px solid var(--rule)",
                    fontSize: 13,
                    lineHeight: 1.5,
                  }}
                >
                  <span>
                    {deviceLabel(s.device)} · {placeLabel(s.place)}
                    <br />
                    <span style={{ fontSize: 12, color: "var(--muted)" }}>
                      {s.current
                        ? `This device · today ${s.lastActive} AM`
                        : s.lastActive}
                    </span>
                  </span>
                  {s.current ? (
                    <span />
                  ) : (
                    <Link href="#" style={{ fontSize: 13 }}>
                      Sign out
                    </Link>
                  )}
                </div>
              ))}
            </div>
            <p
              style={{
                margin: "6px 0 8px",
                fontSize: 12,
                lineHeight: 1.45,
                color: "var(--muted)",
              }}
            >
              Signed in with Google. 2-step verification is on.
            </p>
          </section>

          <EmailSettings />

          <Link href="#" style={{ padding: "0 4px", fontSize: 13 }}>
            Download what Crewspace stores about you
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
