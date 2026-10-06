"use client";

import { useMemo, useState } from "react";

import type { RoleOption } from "@/components/roles/role-select";
import type { DirectoryMember } from "@/lib/members/summaries";

import { MemberTable, MemberCards } from "./member-table";
import { MemberDrawer } from "./member-drawer";
import { BulkActionBar } from "./bulk-action-bar";
import type { TeamMemberEntry } from "./member-teams-editor";

/**
 * DirectoryClient — client interactivity for the server-rendered directory:
 * table (desktop) / cards (mobile), bulk selection, and the member drawer.
 * Filtering, sorting, search, and pagination stay server-side via the URL.
 */
export function DirectoryClient({
  members,
  orgId,
  orgSlug,
  currentUserId,
  permissions,
  roles,
  teams,
  teamMembers,
  leadMembershipByTeam,
  onlineOnly,
}: {
  members: DirectoryMember[];
  orgId: string;
  orgSlug: string;
  currentUserId: string;
  permissions: string[];
  roles: RoleOption[];
  teams: { id: string; name: string }[];
  teamMembers: Record<string, TeamMemberEntry[]>;
  leadMembershipByTeam: Record<string, string | null>;
  onlineOnly: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openMember, setOpenMember] = useState<DirectoryMember | null>(null);

  const canBulk =
    permissions.includes("members:change_role") ||
    permissions.includes("members:deactivate") ||
    permissions.includes("teams:manage");

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const all = members.every((m) => prev.has(m.membershipId));
      if (all) return new Set();
      return new Set(members.map((m) => m.membershipId));
    });
  };

  const selectedMembers = useMemo(
    () => members.filter((m) => selected.has(m.membershipId)),
    [members, selected],
  );

  return (
    <>
      <MemberTable
        members={members}
        selected={selected}
        onToggleSelect={toggleSelect}
        onToggleSelectAll={toggleSelectAll}
        onOpenMember={setOpenMember}
        canBulk={canBulk}
        onlineOnly={onlineOnly}
      />
      <MemberCards members={members} onOpenMember={setOpenMember} onlineOnly={onlineOnly} />

      <BulkActionBar
        orgId={orgId}
        orgSlug={orgSlug}
        selectedIds={selectedMembers.map((m) => m.membershipId)}
        selectedNames={selectedMembers.map((m) => m.fullName)}
        onClear={() => setSelected(new Set())}
        roles={roles}
        teams={teams}
        canChangeRole={permissions.includes("members:change_role")}
        canDeactivate={permissions.includes("members:deactivate")}
        canManageTeams={permissions.includes("teams:manage")}
      />

      <MemberDrawer
        member={openMember}
        onClose={() => setOpenMember(null)}
        orgId={orgId}
        orgSlug={orgSlug}
        currentUserId={currentUserId}
        permissions={permissions}
        roles={roles}
        teams={teams}
        teamMembers={teamMembers}
        leadMembershipByTeam={leadMembershipByTeam}
      />
    </>
  );
}
