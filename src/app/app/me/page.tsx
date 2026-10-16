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
import { IconCheck, IconLock, IconShieldCheck } from "@/components/icons";
import { EmailSettings, ProfileForm } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Crewspace — Your profile and access",
};

/* P-05 Profile — screens/Profile.html. Maya Jordan's own view (042).
   The "You can / You can't" lists are plain-word phrases keyed by
   permission id (§13 register), filtered by
   memberEffectivePermissions(042), so they always agree with the
   register. */

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
    { ids: [9, 10], text: "Create teams and change who’s on them" },
    { ids: [11], text: "Resend or cancel invitations" },
    { ids: [7], text: "Read the audit log" },
  ].filter((row) => row.ids.some((id) => allowed.has(id)));

  const cant: { ids: number[]; text: string }[] = [
    { ids: [2, 14], text: "Deactivate anyone or sign them out" },
    { ids: [5, 6], text: "Change what a role allows, or create roles" },
    { ids: [12], text: "Import people from a file" },
    {
      ids: [13, 15, 16, 17],
      text: "Change sign-in rules, billing or organization settings",
    },
    { ids: [8], text: "Export the audit archive" },
  ].filter((row) => row.ids.some((id) => blocked.has(id)));

  return (
    <AppShell current="none" navVariant="profile" personId="042">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 26,
        }}
      >
        <span className="p-rno" style={{ alignSelf: "flex-start" }}>
          Member {me.id}
        </span>
        <h1 className="p-title">Your profile and access</h1>
      </div>

      <div className="p-cols">
        <div className="p-stack">
          <section className="card" aria-labelledby="ya" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "22px 22px 18px",
                display: "flex",
                gap: 16,
                alignItems: "flex-start",
              }}
            >
              <span className="p-ibx" aria-hidden="true">
                <IconShieldCheck width={28} height={28} strokeWidth={1.3} />
              </span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <h2 id="ya" className="p-h20">
                  What you can do here
                </h2>
                <p
                  style={{
                    margin: 0,
                    fontSize: 14.5,
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
            </div>
            <div className="p-can-grid">
              <div className="p-can-cell can">
                <h3>You can</h3>
                <ul className="p-li">
                  {can.map((row) => (
                    <li key={row.text}>
                      <span className="dot ok">
                        <IconCheck />
                      </span>
                      <span>{row.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="p-can-cell cant">
                <h3>You can’t</h3>
                <ul className="p-li" style={{ color: "var(--ink-2)" }}>
                  {cant.map((row) => (
                    <li key={row.text}>
                      <span className="dot">
                        <IconLock />
                      </span>
                      <span>{row.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="p-askbar">
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

        <aside className="p-aside">
          <section
            className="card"
            aria-labelledby="se"
            style={{ padding: "18px 18px 8px" }}
          >
            <h2 id="se" className="p-panel" style={{ marginBottom: 8 }}>
              Where you’re signed in
            </h2>
            <div>
              {(me.sessions ?? []).map((s) => {
                const phone = s.device.includes("iPhone");
                return (
                  <div
                    key={s.device}
                    className="p-sess"
                    style={{ padding: "11px 0" }}
                  >
                    <span
                      className={s.current ? "p-ico32 is-seal" : "p-ico32 is-flat"}
                      aria-hidden="true"
                    >
                      {phone ? (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="4.5" y="1.8" width="7" height="12.4" rx="1.5" />
                          <path d="M7.3 11.8h1.4" />
                        </svg>
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="3" width="12" height="8" rx="1.2" />
                          <path d="M5.5 13.5h5" />
                        </svg>
                      )}
                    </span>
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
                      <Link href="#" style={{ fontSize: 13, fontWeight: 600 }}>
                        Sign out
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
            <p
              style={{
                margin: "0 0 8px",
                paddingTop: 10,
                borderTop: "1px solid var(--rule)",
                fontSize: 12,
                lineHeight: 1.45,
                color: "var(--muted)",
              }}
            >
              Signed in with Google. 2-step verification is on.
            </p>
          </section>

          <EmailSettings />

          <Link
            href="#"
            style={{
              display: "inline-flex",
              gap: 8,
              alignItems: "center",
              padding: "0 4px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M8 2.5v8M4.8 7.5 8 10.7l3.2-3.2" />
              <path d="M2.5 12.5h11" />
            </svg>
            Download what Crewspace stores about you
          </Link>
        </aside>
      </div>
    </AppShell>
  );
}
