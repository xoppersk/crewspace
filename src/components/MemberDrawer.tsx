"use client";

import Link from "next/link";
import {
  getInvitations,
  getMember,
  getRole,
  getTeam,
  roleAllows,
  settingResult,
  type WorkspaceData,
} from "@/lib/api";
import { setMemberActive } from "@/lib/data/actions";
import type { Member } from "@/lib/types";
import { Button, ButtonLink } from "./Button";
import { Drawer, DrawerClose } from "./Drawer";
import { PermissionStrip } from "./PermissionStrip";
import { RoleTag } from "./RoleTag";
import { IconCheck } from "./icons";
import { initialsOf, tintFor } from "./MemberRow";

/**
 * P-03: a member's record over the Directory — Access, Teams, Sign-in,
 * History, with the destructive actions in the footer.
 * Geometry and copy follow screens/MemberDrawer.html.
 */
export function MemberDrawer({
  member,
  data,
  onClose,
  lastActiveText,
  offline = false,
  canDeactivate = false,
}: {
  member: Member;
  /** The workspace data (loaded server-side, passed through). */
  data: WorkspaceData;
  onClose: () => void;
  lastActiveText?: string;
  offline?: boolean;
  /** The viewer's real permission (checked again server-side). */
  canDeactivate?: boolean;
}) {
  const role = getRole(data, member.roleId)!;
  const org = data.org;
  const perms = data.org.permissions;
  /* Design DOM order (MemberDrawer.html): Invite, Change member roles,
     Edit member profiles, Create teams, Manage team membership,
     Resend or revoke, Read audit log (§13 register ids below). */
  const CAN_ORDER = [1, 4, 3, 9, 10, 11, 7];
  const rank = (id: number) => {
    const i = CAN_ORDER.indexOf(id);
    return i === -1 ? 100 + id : i;
  };
  const allowedNames = [...perms]
    .sort((a, b) => rank(a.id) - rank(b.id))
    .filter(
      (p) => settingResult(data, role.settings[String(p.id)]!, p.id) === "Allowed",
    )
    .map((p) => p.name);
  const pending = role.pendingChanges ?? [];
  const newlyAllowed = pending
    .filter(
      (c) =>
        settingResult(data, c.to, c.permissionId) === "Allowed" &&
        settingResult(data, c.from, c.permissionId) !== "Allowed",
    )
    .map((c) => perms.find((p) => p.id === c.permissionId)!.name);
  const invitation = getInvitations(data).find((i) => i.email === member.email);
  const sessions = member.sessions?.length ?? 1;
  const firstName = member.name.split(" ")[0];

  return (
    <Drawer
      labelledBy="drawer-name"
      onClose={onClose}
      footer={
        <footer className="p-drawer-foot">
          <Button
            disabled
            title="Session management for other members isn't available in this workspace yet"
          >
            Sign out everywhere
          </Button>
          <Button
            variant="dest"
            disabled={offline || !canDeactivate || member.status !== "active"}
            title={
              !canDeactivate
                ? "You don't have permission to deactivate members"
                : undefined
            }
            onClick={async () => {
              const res = await setMemberActive(member.id, false);
              if (res.ok) onClose();
            }}
          >
            Deactivate
          </Button>
        </footer>
      }
    >
      <header
        style={{
          padding: "20px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
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
          <span className="p-rno">Member {member.id}</span>
          <DrawerClose onClose={onClose} />
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <span
            className="p-mono52"
            aria-hidden="true"
            style={{ background: tintFor(member.id), color: "var(--ink)" }}
          >
            {initialsOf(member.name)}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <h2 id="drawer-name" className="p-drawer-name">
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
          </div>
        </div>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
        >
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

      <section className="ds p-ds" aria-labelledby="ds-access">
        <h3 id="ds-access">Access</h3>
        <span
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 14,
          }}
        >
          <RoleTag role={role} />
          <span style={{ fontSize: 13, color: "var(--ink-2)" }}>
            <b style={{ color: "var(--seal)", fontWeight: 600 }}>
              allows {roleAllows(data, role)} of 18
            </b>
          </span>
        </span>
        <PermissionStrip role={role} permissions={perms} baselineIds={org.baseline.allowedPermissionIds} full />
        <ul className="can">
          {allowedNames.map((n) => (
            <li key={n}>
              <span className="p-check">
                <IconCheck strokeWidth={2.2} />
              </span>
              {n}
            </li>
          ))}
        </ul>
        {pending.length > 0 && newlyAllowed.length > 0 ? (
          <p className="p-pending-note">
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

      <section className="ds p-ds" aria-labelledby="ds-teams">
        <h3 id="ds-teams">Teams</h3>
        <dl className="kv">
          {member.teams.map((t) => {
            const team = getTeam(data, t.teamId)!;
            const lead = team.leadId ? getMember(data, team.leadId) : undefined;
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

      <section className="ds p-ds" aria-labelledby="ds-signin">
        <h3 id="ds-signin">Sign-in</h3>
        <dl className="kv">
          <dt>Method</dt>
          <dd>Google, {org.domain}</dd>
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

      <section className="ds p-ds" aria-labelledby="ds-history">
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
                Invited by {getMember(data, invitation.invitedById)?.name ?? "—"}
              </dd>
            </>
          ) : (
            <>
              <dt className="mono" style={{ fontSize: 12 }}>
                {member.joined}
              </dt>
              <dd>Joined {getTeam(data, member.teams[0]?.teamId ?? "")?.name ?? "the organization"}</dd>
            </>
          )}
        </dl>
      </section>
    </Drawer>
  );
}

export { Link };
