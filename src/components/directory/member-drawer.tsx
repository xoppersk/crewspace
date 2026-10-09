"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, GripHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RoleBadge } from "@/components/roles/role-badge";
import type { RoleOption } from "@/components/roles/role-select";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";
import {
  deactivateMember,
  reactivateMember,
  removeMember,
  updateMemberRole,
  type ActionResult,
} from "@/lib/members/actions";
import type { DirectoryMember } from "@/lib/members/summaries";
import { cn } from "@/lib/utils";

import { MemberAvatar } from "./member-avatar";
import { LocalTime } from "./local-time";
import { TypeToConfirmDialog } from "./type-to-confirm-dialog";
import { RoleChangeDialog } from "./role-change-dialog";
import { MemberTeamsEditor, type TeamMemberEntry } from "./member-teams-editor";

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5",
        isActive ? "border-success/40 text-success" : "border-destructive/40 text-destructive",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", isActive ? "bg-success" : "bg-destructive")}
        aria-hidden
      />
      {isActive ? "Active" : "Deactivated"}
    </Badge>
  );
}

/**
 * MemberDrawer — slide-over (desktop) / bottom sheet (mobile) for a directory
 * row. Profile header, contact, teams with change control, role change,
 * status toggle, and the danger zone. Every privileged control is gated on
 * the viewer's permission (layer 1); the Server Actions re-check (layer 2).
 */
export function MemberDrawer({
  member,
  onClose,
  orgId,
  orgSlug,
  currentUserId,
  permissions,
  roles,
  teams,
  teamMembers,
  leadMembershipByTeam,
}: {
  member: DirectoryMember | null;
  onClose: () => void;
  orgId: string;
  orgSlug: string;
  currentUserId: string;
  permissions: string[];
  roles: RoleOption[];
  teams: { id: string; name: string }[];
  teamMembers: Record<string, TeamMemberEntry[]>;
  /** team id → lead membership id (null when no lead). */
  leadMembershipByTeam: Record<string, string | null>;
}) {
  const isMobile = useIsMobile();
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  const canChangeRole = permissions.includes("members:change_role");
  const canDeactivate = permissions.includes("members:deactivate");
  const canManageTeams = permissions.includes("teams:manage");
  const isSelf = member?.userId === currentUserId;

  const currentRoleOption = roles.find((r) => r.id === member?.roleId);
  const currentPermissionCount = currentRoleOption?.permissionCount ?? 0;

  const callAction = (fn: () => Promise<ActionResult>) => fn();

  return (
    <Sheet open={member !== null} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side={isMobile ? "bottom" : "right"}
        className={cn(
          isMobile && "max-h-[92dvh] rounded-t-2xl",
          !isMobile && "w-full sm:max-w-md",
        )}
        aria-label={member ? `${member.fullName}'s profile` : "Member profile"}
      >
        {isMobile ? (
          <div className="mx-auto -mb-2 flex h-6 w-24 items-center justify-center" aria-hidden>
            <GripHorizontal className="size-5 text-muted-foreground" />
          </div>
        ) : null}

        {member ? (
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 pb-6">
            {/* Profile header */}
            <SheetHeader className="items-start p-0 text-left">
              <div className="flex items-start gap-3">
                <MemberAvatar
                  name={member.fullName}
                  avatarUrl={member.avatarUrl}
                  userId={member.userId}
                  size="lg"
                  showPresence
                />
                <div className="min-w-0 flex-1">
                  <SheetTitle className="text-lg">{member.fullName}</SheetTitle>
                  <SheetDescription>
                    {member.title ?? "No title set"}
                  </SheetDescription>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusBadge isActive={member.isActive} />
                    <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
                  </div>
                </div>
              </div>
              <Button asChild variant="link" className="h-auto justify-start p-0 text-sm">
                <Link href={`/${orgSlug}/directory/${member.membershipId}`}>
                  View full profile <ChevronRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </SheetHeader>

            {!member.isActive ? (
              <div className="border border-warning/40 bg-warning-soft p-3 text-sm">
                <p className="font-medium text-warning">
                  Deactivated
                  {member.deactivatedAt
                    ? ` — access stopped on ${new Date(member.deactivatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                    : " — access stopped"}
                </p>
                <p className="mt-0.5 text-muted-foreground">
                  They can&rsquo;t access the organization. Their role and teams are preserved.
                </p>
                {canDeactivate && !isSelf ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 min-h-11 sm:min-h-9"
                    onClick={() => setReactivateOpen(true)}
                  >
                    Reactivate
                  </Button>
                ) : null}
              </div>
            ) : null}

            {/* Contact */}
            <section className="flex flex-col gap-1.5">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Contact
              </h3>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
                <span className="text-muted-foreground">Local time</span>
                <span className="flex items-center gap-2">
                  <LocalTime timezone={member.timezone} />
                  <span className="text-xs text-muted-foreground">{member.timezone}</span>
                </span>
              </div>
            </section>

            {/* Teams */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Teams
              </h3>
              <MemberTeamsEditor
                orgId={orgId}
                orgSlug={orgSlug}
                membershipId={member.membershipId}
                memberName={member.fullName}
                teams={member.teamIds.map((id, i) => ({
                  id,
                  name: member.teamNames[i] ?? id,
                  isLead: leadMembershipByTeam[id] === member.membershipId,
                }))}
                allTeams={teams}
                teamMembers={teamMembers}
                canManage={canManageTeams}
              />
            </section>

            {/* Role */}
            <section className="flex flex-col gap-2">
              <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Role
              </h3>
              <div className="flex min-h-11 items-center justify-between rounded-lg border px-3 py-2">
                <RoleBadge roleName={member.roleName} systemKey={member.roleSystemKey} />
                {canChangeRole && !isSelf ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="min-h-9"
                    onClick={() => setRoleDialogOpen(true)}
                  >
                    Change role
                  </Button>
                ) : null}
              </div>
              {isSelf ? (
                <p className="text-xs text-muted-foreground">
                  You can&rsquo;t change your own role — ask another admin.
                </p>
              ) : null}
            </section>

            {/* Status toggle */}
            {canDeactivate && !isSelf && member.isActive ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Status
                </h3>
                <Button
                  variant="outline"
                  className="min-h-11 justify-start sm:min-h-9"
                  onClick={() => setDeactivateOpen(true)}
                >
                  Deactivate {member.fullName}
                </Button>
              </section>
            ) : null}

            {/* Danger zone */}
            {canDeactivate && !isSelf ? (
              <section className="flex flex-col gap-2 rounded-lg border border-destructive/30 p-3">
                <h3 className="text-xs font-medium tracking-wide text-destructive uppercase">
                  Danger zone
                </h3>
                <p className="text-sm text-muted-foreground">
                  Permanently remove {member.fullName} from the organization. This can&rsquo;t be undone.
                </p>
                <Button
                  variant="destructive"
                  className="min-h-11 justify-start sm:min-h-9"
                  onClick={() => setRemoveOpen(true)}
                >
                  Remove from organization
                </Button>
              </section>
            ) : null}
          </div>
        ) : null}

        {/* Dialogs (rendered once, driven by state) */}
        {member ? (
          <>
            <RoleChangeDialog
              open={roleDialogOpen}
              onOpenChange={setRoleDialogOpen}
              memberName={member.fullName}
              currentRole={{
                id: member.roleId,
                name: member.roleName,
                systemKey: member.roleSystemKey,
                permissionCount: currentPermissionCount,
              }}
              roles={roles}
              onConfirm={(roleId) => callAction(() => updateMemberRole(orgId, orgSlug, member.membershipId, roleId))}
            />
            <TypeToConfirmDialog
              open={deactivateOpen}
              onOpenChange={setDeactivateOpen}
              title={`Deactivate ${member.fullName}`}
              description={
                <>
                  This will immediately remove {member.fullName}&rsquo;s access to the organization.
                  Their role and teams are kept, so you can reactivate them later without losing
                  anything. This is recorded in the audit log.
                </>
              }
              expected={member.fullName}
              confirmLabel="Deactivate member"
              onConfirm={() => callAction(() => deactivateMember(orgId, orgSlug, member.membershipId))}
            />
            <TypeToConfirmDialog
              open={reactivateOpen}
              onOpenChange={setReactivateOpen}
              title={`Reactivate ${member.fullName}`}
              description={
                <>
                  {member.fullName}&rsquo;s previous role and teams will be restored immediately. This is
                  recorded in the audit log.
                </>
              }
              expected={member.fullName}
              confirmLabel="Reactivate member"
              destructive={false}
              onConfirm={() => callAction(() => reactivateMember(orgId, orgSlug, member.membershipId))}
            />
            <TypeToConfirmDialog
              open={removeOpen}
              onOpenChange={setRemoveOpen}
              title={`Remove ${member.fullName}`}
              description={
                <>
                  This permanently removes {member.fullName} from the organization, including their
                  team memberships. If they lead any team, you&rsquo;ll need to pick a successor first.
                  This can&rsquo;t be undone.
                </>
              }
              expected={member.fullName}
              confirmLabel="Remove permanently"
              onConfirm={() =>
                callAction(() => removeMember(orgId, orgSlug, member.membershipId, member.fullName))
              }
            />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
