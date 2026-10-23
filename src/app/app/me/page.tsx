import Link from "next/link";
import type { Metadata } from "next";
import {
  getInvitations,
  getMember,
  getMembers,
  getRole,
  getTeam,
  memberEffectivePermissions,
} from "@/lib/api";
import {
  getActiveWorkspace,
  loadActiveWorkspaceData,
} from "@/lib/data/server";
import { createClient } from "@/lib/supabase/server";
import { shortId } from "@/components/MemberRow";
import { AppShell } from "@/components/Shell";
import { IconCheck, IconLock, IconShieldCheck } from "@/components/icons";
import { DownloadMyData, EmailSettings, ProfileForm } from "./ProfileClient";

export const metadata: Metadata = {
  title: "Crewspace — Your profile and access",
};

/* P-05 Profile — the REAL signed-in user's own view: their
   membership, their role, and their effective permissions from the
   register, so the lists always agree with the register. */

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

export default async function ProfilePage() {
  const data = await loadActiveWorkspaceData();
  if (!data) {
    return <AppShell current="none" navVariant="profile">{null}</AppShell>;
  }
  const ws = await getActiveWorkspace();
  const me = getMember(data, ws!.membershipId)!;
  const role = getRole(data, me.roleId)!;
  const effective = memberEffectivePermissions(data, me);
  // The profile's timezone lives on profiles (not in the Member shape).
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("id", ws!.userId)
    .maybeSingle();
  const allowed = new Set(
    effective.filter((e) => e.result === "Allowed").map((e) => e.permission.id),
  );
  const blocked = new Set(
    effective.filter((e) => e.result === "Blocked").map((e) => e.permission.id),
  );

  const team = me.teams[0] ? getTeam(data, me.teams[0].teamId) : undefined;
  const lead = team?.leadId ? getMember(data, team.leadId) : undefined;
  const invitation = getInvitations(data).find((i) => i.email === me.email);
  const giver = invitation ? getMember(data, invitation.invitedById) : undefined;
  const owner = getMembers(data).find((m) => m.roleId === "owner");

  const can: { ids: number[]; text: string }[] = [
    { ids: [1], text: "Invite people and pick their first role" },
    { ids: [4], text: "Move people between roles" },
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
    <AppShell current="none" navVariant="profile">
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 26,
        }}
      >
        <span className="p-rno" style={{ alignSelf: "flex-start" }}>
          Member {shortId(me.id)}
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
                  </b>
                  {team ? <> on the {team.name} team.</> : "."}
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
                {owner
                  ? `Need something on the right? Ask ${owner.name}, the owner.`
                  : "Need something on the right? Ask your organization owner."}
                {lead ? ` ${lead.name}, your team lead, is copied.` : ""}
              </span>
            </div>
          </section>

          <ProfileForm
            initialName={me.name}
            initialTitle={me.title ?? ""}
            initialTimezone={profile?.timezone ?? "UTC"}
            email={me.email}
            orgName={data.org.name}
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
            {!(me.sessions ?? []).length ? (
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 13,
                  color: "var(--ink-2)",
                }}
              >
                Last active {me.lastActive}. Individual session devices
                aren’t listed yet.
              </p>
            ) : null}
          </section>

          <EmailSettings />

          <DownloadMyData
            record={{
              name: me.name,
              email: me.email,
              title: me.title ?? null,
              role: role.name,
              teams: me.teams.map(
                (t) => getTeam(data, t.teamId)?.name ?? t.teamId,
              ),
              joined: me.joined,
              status: me.status,
            }}
          />
        </aside>
      </div>
    </AppShell>
  );
}
