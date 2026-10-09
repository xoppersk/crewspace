"use client";

import { useState } from "react";
import { ShieldCheck, UserX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "@/components/roles/role-badge";
import type { RoleOption } from "@/components/roles/role-select";
import { PresenceDot } from "@/components/presence/presence-dot";
import { usePresence } from "@/components/presence/presence-provider";
import { formatAbsoluteDate, formatAbsoluteTime, formatRelativeTime } from "@/lib/datetime";
import {
  deactivateMember,
  reactivateMember,
  removeMember,
  updateMemberRole,
} from "@/lib/members/actions";
import { cn } from "@/lib/utils";

import { MemberAvatar } from "./member-avatar";
import { LocalTime } from "./local-time";
import { TypeToConfirmDialog } from "./type-to-confirm-dialog";
import { RoleChangeDialog } from "./role-change-dialog";
import { MemberTeamsEditor, type MemberTeamEntry, type TeamMemberEntry } from "./member-teams-editor";

export interface EffectivePermission {
  key: string;
  resource: string;
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

/**
 * MemberDetailClient — the full member profile page body. Read-only for
 * viewers without admin permissions: the Admin actions card and all change
 * controls only render when the viewer holds the relevant key (layer 1);
 * Server Actions re-check everything (layer 2).
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
  history,
}: {
  orgId: string;
  orgSlug: string;
  currentUserId: string;
  permissions: string[];
  member: {
    membershipId: string;
    userId: string;
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
  history: RoleHistoryEntry[];
}) {
  const { isOnline } = usePresence();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const canChangeRole = permissions.includes("members:change_role");
  const canDeactivate = permissions.includes("members:deactivate");
  const canManageTeams = permissions.includes("teams:manage");
  const isSelf = member.userId === currentUserId;
  const showAdminActions = (canChangeRole || canDeactivate) && !isSelf;

  const grouped = new Map<string, EffectivePermission[]>();
  for (const p of effectivePermissions) {
    const list = grouped.get(p.resource) ?? [];
    list.push(p);
    grouped.set(p.resource, list);
  }

  const currentRoleOption = roles.find((r) => r.id === member.roleId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <MemberAvatar
          name={member.fullName}
          avatarUrl={member.avatarUrl}
          userId={member.userId}
          size="lg"
          showPresence
          className="scale-150"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">{member.fullName}</h1>
            {isOnline(member.userId) ? (
              <span className="flex items-center gap-1.5 text-sm text-success">
                <PresenceDot userId={member.userId} /> Online
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground">{member.title ?? "No title set"}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5",
                member.isActive
                  ? "border-success/40 text-success"
                  : "border-destructive/40 text-destructive",
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  member.isActive ? "bg-success" : "bg-destructive",
                )}
                aria-hidden
              />
              {member.isActive ? "Active" : "Deactivated"}
            </Badge>
            <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Joined {formatAbsoluteTime(member.joinedAt)} · Last active{" "}
            {formatRelativeTime(member.lastActiveAt)}
          </p>
        </div>
      </div>

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
        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">
              {member.bio ?? "No bio yet."}
            </p>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-muted-foreground">Timezone</span>
              <span className="flex items-center gap-2">
                <LocalTime timezone={member.timezone} />
                <span className="text-xs text-muted-foreground">{member.timezone}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Teams */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Teams</CardTitle>
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
          </CardContent>
        </Card>

        {/* Role & access */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Role & access</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Current role</span>
                <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
              </div>
              {canChangeRole && !isSelf ? (
                <Button variant="outline" size="sm" className="min-h-9" onClick={() => setRoleDialogOpen(true)}>
                  <ShieldCheck className="size-4" aria-hidden /> Change role
                </Button>
              ) : null}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Effective permissions ({effectivePermissions.length})
              </h3>
              {effectivePermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">This role grants no permissions.</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[...grouped.entries()].map(([resource, perms]) => (
                    <div key={resource} className="rounded-lg border p-3">
                      <p className="mb-1.5 text-xs font-semibold tracking-wide uppercase">{resource}</p>
                      <ul className="flex flex-col gap-1">
                        {perms.map((p) => (
                          <li key={p.key} className="text-sm" title={p.description ?? undefined}>
                            {p.label}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Assignment history
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recorded changes.</p>
              ) : (
                <ul className="flex flex-col">
                  {history.map((entry) => (
                    <li
                      key={entry.id}
                      className="flex items-baseline justify-between gap-3 border-t py-2 text-sm first:border-t-0"
                    >
                      <span>{historySentence(entry, member.fullName)}</span>
                      <span
                        className="shrink-0 text-xs text-muted-foreground tabular-nums"
                        title={formatAbsoluteTime(entry.createdAt)}
                      >
                        {formatRelativeTime(entry.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin actions */}
        {showAdminActions ? (
          <Card className="border-destructive/30 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base text-destructive">Admin actions</CardTitle>
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
