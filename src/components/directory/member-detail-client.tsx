"use client";

import { useState } from "react";
import { ShieldCheck, UserX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/roles/role-badge";
import { RoleSeal } from "@/components/crew/role-seal";
import type { RoleOption } from "@/components/roles/role-select";
import { formatAbsoluteDate } from "@/lib/datetime";
import {
  deactivateMember,
  reactivateMember,
  removeMember,
  updateMemberRole,
} from "@/lib/members/actions";

import { RoleChangeDialog } from "./role-change-dialog";
import { TypeToConfirmDialog } from "./type-to-confirm-dialog";
import { MemberTeamsEditor, type MemberTeamEntry, type TeamMemberEntry } from "./member-teams-editor";

export interface EffectivePermission {
  key: string;
  resource: string;
  label: string;
  description: string | null;
}

export interface DeniedPermission {
  key: string;
  label: string;
  description: string | null;
}

export interface RoleHistoryEntry {
  id: string;
  action: string;
  actorName: string;
  diff: Record<string, unknown>;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "membership.created": "Joined the organization",
  "membership.role_changed": "Role changed",
  "membership.deactivated": "Deactivated",
  "membership.reactivated": "Reactivated",
  "membership.removed": "Removed",
};

function historySentence(entry: RoleHistoryEntry, memberName: string): string {
  const diff = entry.diff as { role?: { from?: string; to?: string } };
  switch (entry.action) {
    case "membership.role_changed":
      return `${entry.actorName} changed ${memberName}'s role from ${diff.role?.from ?? "—"} to ${diff.role?.to ?? "—"}`;
    case "membership.created":
      return `${memberName} joined the organization`;
    case "membership.deactivated":
      return `${entry.actorName} deactivated ${memberName}`;
    case "membership.reactivated":
      return `${entry.actorName} reactivated ${memberName}`;
    case "membership.removed":
      return `${entry.actorName} removed ${memberName}`;
    default:
      return ACTION_LABELS[entry.action] ?? entry.action;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length > 1 && parts[0] && parts[1]) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return (parts[0] ?? "?").slice(0, 2).toUpperCase();
}

/** "October 6, 2026 · 8:42 AM" — the artifact's event timestamp. */
function formatEventTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}

/**
 * MemberDetailClient — the personnel register entry (Flagship UI Designs
 * artifact, Crewspace member detail): kicker header, the stamped
 * member-register hero, then the Access record and Recent access events
 * cards. Administration (teams, role change, deactivate/remove) follows
 * below for viewers with the relevant keys; Server Actions re-check
 * everything (layer 2).
 */
export function MemberDetailClient({
  orgId,
  orgSlug,
  currentUserId,
  permissions,
  member,
  teams,
  allTeams,
  teamMembers,
  roles,
  effectivePermissions,
  deniedPermissions,
  history,
}: {
  orgId: string;
  orgSlug: string;
  currentUserId: string;
  permissions: string[];
  member: {
    membershipId: string;
    userId: string;
    registerNo: string;
    fullName: string;
    avatarUrl: string | null;
    title: string | null;
    bio: string | null;
    timezone: string;
    isActive: boolean;
    lastActiveAt: string | null;
    joinedAt: string;
    deactivatedAt: string | null;
    roleId: string;
    roleName: string;
    roleSystemKey: string | null;
  };
  teams: MemberTeamEntry[];
  allTeams: { id: string; name: string }[];
  teamMembers: Record<string, TeamMemberEntry[]>;
  roles: RoleOption[];
  effectivePermissions: EffectivePermission[];
  deniedPermissions: DeniedPermission[];
  history: RoleHistoryEntry[];
}) {
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const canChangeRole = permissions.includes("members:change_role");
  const canDeactivate = permissions.includes("members:deactivate");
  const canManageTeams = permissions.includes("teams:manage");
  const isSelf = member.userId === currentUserId;
  const showAdminActions = (canChangeRole || canDeactivate) && !isSelf;

  const currentRoleOption = roles.find((r) => r.id === member.roleId);
  const joinedLabel = new Date(member.joinedAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const statusDate = member.lastActiveAt ?? member.joinedAt;
  const statusDateLabel = new Date(statusDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  interface FeedRow {
    badge: string;
    title: string;
    sub: string;
    time: string;
  }

  const accessRows: FeedRow[] = [
    ...teams.map((team, i) => ({
      badge: String(i + 1).padStart(2, "0"),
      title: team.name,
      sub: team.isLead ? "Team membership · Team lead" : "Team membership",
      time: `Since ${joinedLabel}`,
    })),
    ...effectivePermissions.map((p, i) => ({
      badge: String(teams.length + i + 1).padStart(2, "0"),
      title: p.label,
      sub: p.description ?? `Granted by the ${member.roleName} role`,
      time: "Allowed",
    })),
    ...deniedPermissions.map((p, i) => ({
      badge: String(teams.length + effectivePermissions.length + i + 1).padStart(2, "0"),
      title: p.label,
      sub: p.description ?? `Denied by the ${member.roleName} role`,
      time: "Denied",
    })),
  ];

  const eventRows: FeedRow[] = [
    ...(member.lastActiveAt
      ? [
          {
            badge: initials(member.fullName),
            title: "Signed in",
            sub: "Last active session",
            time: formatEventTime(member.lastActiveAt),
          },
        ]
      : []),
    ...history.map((entry) => ({
      badge: initials(entry.actorName),
      title: historySentence(entry, member.fullName),
      sub: ACTION_LABELS[entry.action] ?? entry.action,
      time: formatEventTime(entry.createdAt),
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header — the personnel register */}
      <div className="border-b-2 border-foreground pb-4">
        <p className="type-label uppercase tracking-[0.17em] text-muted-foreground">
          Personnel register / Member {member.registerNo}
        </p>
        <h1 className="type-display mt-1">Member detail</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Identity, appointed role, and the access record for this register entry.
        </p>
      </div>

      {/* Member register hero */}
      <section className="member-register" aria-label={`${member.fullName}, Member ${member.registerNo}`}>
        <span className="register-avatar" aria-hidden>
          {initials(member.fullName)}
        </span>
        <div className="min-w-0">
          <h2 className="truncate">{member.fullName}</h2>
          <p className="register-sub">
            <span className="truncate">{member.title ?? "No title set"}</span>
            <RoleSeal>{member.roleName}</RoleSeal>
          </p>
          {member.bio ? (
            <p className="mt-1 truncate text-xs text-muted-foreground">{member.bio}</p>
          ) : null}
        </div>
        <span className={`member-status-line${member.isActive ? "" : " inactive"}`}>
          ● {member.isActive ? "Active" : "Deactivated"} · last active {statusDateLabel}
        </span>
      </section>

      {!member.isActive ? (
        <div className="border border-warning/40 bg-warning-soft p-4 text-sm">
          <p className="font-medium text-warning">
            Deactivated
            {member.deactivatedAt
              ? ` — access stopped on ${formatAbsoluteDate(member.deactivatedAt)}`
              : " — access stopped"}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            They can&rsquo;t access the organization. Their role and teams are preserved for reactivation.
          </p>
          {canDeactivate && !isSelf ? (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 min-h-11 sm:min-h-9"
              onClick={() => setReactivateOpen(true)}
            >
              Reactivate {member.fullName}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Access record */}
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.13em]">
              Access record
            </CardTitle>
          </CardHeader>
          <CardContent>
            {accessRows.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">
                No teams and no decided permissions — this entry inherits the organization
                baseline everywhere.
              </p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {accessRows.map((row, index) => (
                  <li key={index} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-3">
                    <span
                      className="grid size-8 place-items-center border-b-2 border-primary font-mono text-[11px] font-bold"
                      aria-hidden
                    >
                      {row.badge}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{row.title}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {row.sub}
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {row.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent access events */}
        <Card className="rounded-none">
          <CardHeader>
            <CardTitle className="text-sm font-bold uppercase tracking-[0.13em]">
              Recent access events
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventRows.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">No recorded events yet.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {eventRows.map((row, index) => (
                  <li key={index} className="grid grid-cols-[2.5rem_1fr_auto] items-start gap-3 py-3">
                    <span
                      className="grid size-8 place-items-center border-b-2 border-primary font-mono text-[11px] font-bold"
                      aria-hidden
                    >
                      {row.badge}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{row.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{row.sub}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {row.time}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Administration — teams, role, and lifecycle actions (gated) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-none">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold uppercase tracking-[0.13em]">Teams</CardTitle>
            {canChangeRole && !isSelf ? (
              <Button
                variant="outline"
                size="sm"
                className="min-h-9"
                onClick={() => setRoleDialogOpen(true)}
              >
                <ShieldCheck className="size-4" aria-hidden /> Change role
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            <MemberTeamsEditor
              orgId={orgId}
              orgSlug={orgSlug}
              membershipId={member.membershipId}
              memberName={member.fullName}
              teams={teams}
              allTeams={allTeams}
              teamMembers={teamMembers}
              canManage={canManageTeams}
            />
            <div className="mt-4 flex items-center gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">Current role</span>
              <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
            </div>
          </CardContent>
        </Card>

        {showAdminActions ? (
          <Card className="rounded-none border-destructive/30">
            <CardHeader>
              <CardTitle className="text-sm font-bold uppercase tracking-[0.13em] text-destructive">
                Admin actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {member.isActive ? (
                canDeactivate ? (
                  <Button
                    variant="outline"
                    className="min-h-11 justify-start sm:min-h-9"
                    onClick={() => setDeactivateOpen(true)}
                  >
                    <UserX className="size-4" aria-hidden /> Deactivate {member.fullName}
                  </Button>
                ) : null
              ) : canDeactivate ? (
                <Button
                  variant="outline"
                  className="min-h-11 justify-start sm:min-h-9"
                  onClick={() => setReactivateOpen(true)}
                >
                  Reactivate {member.fullName}
                </Button>
              ) : null}
              {canDeactivate ? (
                <Button
                  variant="destructive"
                  className="min-h-11 justify-start sm:min-h-9"
                  onClick={() => setRemoveOpen(true)}
                >
                  Remove from organization
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      {/* Dialogs */}
      <RoleChangeDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        memberName={member.fullName}
        currentRole={{
          id: member.roleId,
          name: member.roleName,
          systemKey: member.roleSystemKey,
          permissionCount: currentRoleOption?.permissionCount ?? effectivePermissions.length,
        }}
        roles={roles}
        onConfirm={(roleId) => updateMemberRole(orgId, orgSlug, member.membershipId, roleId)}
      />
      <TypeToConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={`Deactivate ${member.fullName}`}
        description={
          <>
            This will immediately remove {member.fullName}&rsquo;s access to the organization. Their role
            and teams are kept, so you can reactivate them later without losing anything.
          </>
        }
        expected={member.fullName}
        confirmLabel="Deactivate member"
        onConfirm={() => deactivateMember(orgId, orgSlug, member.membershipId)}
      />
      <TypeToConfirmDialog
        open={reactivateOpen}
        onOpenChange={setReactivateOpen}
        title={`Reactivate ${member.fullName}`}
        description={
          <>{member.fullName}&rsquo;s previous role and teams will be restored immediately.</>
        }
        expected={member.fullName}
        confirmLabel="Reactivate member"
        destructive={false}
        onConfirm={() => reactivateMember(orgId, orgSlug, member.membershipId)}
      />
      <TypeToConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={`Remove ${member.fullName}`}
        description={
          <>
            This permanently removes {member.fullName} from the organization, including their team
            memberships. If they lead any team, pick a successor first. This can&rsquo;t be undone.
          </>
        }
        expected={member.fullName}
        confirmLabel="Remove permanently"
        onConfirm={() => removeMember(orgId, orgSlug, member.membershipId, member.fullName)}
      />
    </div>
  );
}
