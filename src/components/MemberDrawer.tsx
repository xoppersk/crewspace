"use client";

import Link from "next/link";
import {
  getInvitations,
  getMember,
  getPermissions,
  getRole,
  getTeam,
  roleAllows,
  settingResult,
} from "@/lib/api";
import type { Member } from "@/lib/types";
import { Button, ButtonLink } from "./Button";
import { Drawer, DrawerClose } from "./Drawer";
import { PermissionStrip } from "./PermissionStrip";
import { RoleTag } from "./RoleTag";

/**
 * P-03: a member's record over the Directory — Access, Teams, Sign-in,
 * History, with the destructive actions in the footer.
 */
export function MemberDrawer({
  member,
  onClose,
  lastActiveText,
  offline = false,
}: {
  member: Member;
  onClose: () => void;
  lastActiveText?: string;
  /** X-06: access-changing actions pause while the connection is down. */
  offline?: boolean;
}) {
  const role = getRole(member.roleId)!;
  const perms = getPermissions();
  /* Design DOM order (MemberDrawer.html): Change member roles sits
     before Edit member profiles in the two-column "can" grid. */
  const drawerOrder = [...perms].sort((a, b) => {
    const rank = (id: number) => (id === 4 ? 2.5 : id === 3 ? 3.5 : id);
    return rank(a.id) - rank(b.id);
  });
  const allowedNames = drawerOrder
    .filter(
      (p) => settingResult(role.settings[String(p.id)]!, p.id) === "Allowed",
    )
    .map((p) => p.name);
  const pending = role.pendingChanges ?? [];
  const newlyAllowed = pending
    .filter(
      (c) =>
        settingResult(c.to, c.permissionId) === "Allowed" &&
        settingResult(c.from, c.permissionId) !== "Allowed",
    )
    .map((c) => perms.find((p) => p.id === c.permissionId)!.name);
  const invitation = getInvitations().find((i) => i.email === member.email);
  const sessions = member.sessions?.length ?? 1;
  const firstName = member.name.split(" ")[0];

  return (
    <Drawer
      labelledBy="drawer-name"
      onClose={onClose}
      footer={
        <footer
          style={{
            marginTop: "auto",
            padding: "16px 24px",
            borderTop: "1px solid var(--rule-strong)",
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <Button
            disabled={offline}
            title={
              offline
                ? "Sign-out is paused while you are offline"
                : undefined
            }
          >
            Sign out everywhere
          </Button>
          <Button
            style={{ color: "var(--deny)", borderColor: "var(--deny)" }}
            disabled={offline}
            title={
              offline ? "Deactivation is paused while you are offline" : undefined
            }
          >
            Deactivate
          </Button>
        </footer>
      }
    >
      <header
        style={{
          padding: "20px 24px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span className="register">Member {member.id}</span>
          <DrawerClose onClose={onClose} />
        </div>
        <h2
          id="drawer-name"
          style={{
            margin: 0,
            font: "700 24px/1.2 var(--font-sans)",
            letterSpacing: "-0.01em",
          }}
        >
          {member.name}
        </h2>
        <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
          {member.email} ·{" "}
          {member.status === "active" ? (
            <>
              <span style={{ color: "var(--active)", fontWeight: 600 }}>
                Active
              </span>{" "}
              since {member.joined}
            </>
          ) : (
            <span style={{ color: "var(--muted)", fontWeight: 600 }}>
              Deactivated {member.deactivatedOn}
            </span>
          )}
        </span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <ButtonLink variant="pri" href={`/app/people/${member.id}`}>
            Open full record
          </ButtonLink>
          <Button
            disabled={offline}
            title={
              offline ? "Role changes are paused while you are offline" : undefined
            }
          >
            Change role
          </Button>
        </div>
      </header>

      <section className="ds" aria-labelledby="ds-access">
        <h3 id="ds-access">Access</h3>
        <span style={{ fontSize: 14 }}>
          <RoleTag role={role} />{" "}
          <span
            style={{ fontSize: 13, color: "var(--ink-2)", marginLeft: 6 }}
          >
            allows {roleAllows(role)} of 18
          </span>
        </span>
        <PermissionStrip role={role} full />
        <ul className="can">
          {allowedNames.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        {pending.length > 0 && newlyAllowed.length > 0 ? (
          <p className="tint-note">
            {role.name} has {pending.length} changes waiting for review. If
            you apply them, {firstName} can also{" "}
            <b>
              {newlyAllowed
                .map((n) => n.charAt(0).toLowerCase() + n.slice(1))
                .join(", ")}
            </b>
            .
          </p>
        ) : null}
      </section>

      <section className="ds" aria-labelledby="ds-teams">
        <h3 id="ds-teams">Teams</h3>
        <dl className="kv">
          {member.teams.map((t) => {
            const team = getTeam(t.teamId)!;
            const lead = team.leadId ? getMember(team.leadId) : undefined;
            return (
              <div key={t.teamId} style={{ display: "contents" }}>
                <dt>{team.name}</dt>
                <dd>
                  Member since {member.joined}
                  {lead ? ` · lead is ${lead.name}` : ""}
                </dd>
              </div>
            );
          })}
          {member.teams.length === 0 ? (
            <>
              <dt>Teams</dt>
              <dd>Not on a team</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="ds" aria-labelledby="ds-signin">
        <h3 id="ds-signin">Sign-in</h3>
        <dl className="kv">
          <dt>Method</dt>
          <dd>Google, sevynlabs.io</dd>
          <dt>2-step</dt>
          <dd>
            {member.twoStep === false ? "Off" : "On, authenticator app"}
          </dd>
          <dt>Last active</dt>
          <dd>
            {lastActiveText ??
              `${member.lastActive} · ${sessions} session${sessions === 1 ? "" : "s"}`}
          </dd>
        </dl>
      </section>

      <section className="ds" aria-labelledby="ds-history">
        <h3 id="ds-history">History</h3>
        <dl className="kv">
          {invitation?.acceptedOn ? (
            <>
              <dt className="mono" style={{ fontSize: 12 }}>
                {invitation.acceptedOn}
              </dt>
              <dd>Accepted invitation; {role.name} applied</dd>
            </>
          ) : null}
          {invitation ? (
            <>
              <dt className="mono" style={{ fontSize: 12 }}>
                {invitation.sent}
              </dt>
              <dd>
                Invited by {getMember(invitation.invitedById)?.name ?? "—"}
              </dd>
            </>
          ) : (
            <>
              <dt className="mono" style={{ fontSize: 12 }}>
                {member.joined}
              </dt>
              <dd>Joined {getTeam(member.teams[0]?.teamId ?? "")?.name ?? "the organization"}</dd>
            </>
          )}
        </dl>
      </section>
    </Drawer>
  );
}

export { Link };
