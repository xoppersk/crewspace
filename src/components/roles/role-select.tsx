"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleBadge } from "./role-badge";

/**
 * RoleSelect — reusable role picker for member role-change flows.
 * Owned by Worker 3; Worker 4's member drawer and the directory bulk
 * role-change import this. Each option shows the role badge plus a
 * permission summary so the consequence of picking it is visible.
 */

export interface RoleOption {
  id: string;
  name: string;
  systemKey: string | null;
  /** Number of permission keys the role grants. */
  permissionCount: number;
  /** Active memberships holding the role (optional context). */
  memberCount?: number;
}

export function RoleSelect({
  roles,
  value,
  onValueChange,
  placeholder = "Select a role",
  disabled = false,
  excludeRoleIds = [],
  id,
}: {
  roles: RoleOption[];
  value?: string;
  onValueChange?: (roleId: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Role ids to hide (e.g. the member's current role). */
  excludeRoleIds?: string[];
  id?: string;
}) {
  const options = roles.filter((role) => !excludeRoleIds.includes(role.id));
  const selected = roles.find((role) => role.id === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={placeholder}>
          {selected ? (
            <span className="flex items-center gap-2">
              <RoleBadge roleName={selected.name} systemKey={selected.systemKey} />
              <span className="text-muted-foreground text-xs">
                {selected.permissionCount} permission{selected.permissionCount === 1 ? "" : "s"}
              </span>
            </span>
          ) : null}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((role) => (
          <SelectItem key={role.id} value={role.id}>
            <span className="flex w-full items-center gap-2 py-0.5">
              <RoleBadge roleName={role.name} systemKey={role.systemKey} />
              <span className="text-muted-foreground text-xs">
                {role.permissionCount} permission{role.permissionCount === 1 ? "" : "s"}
                {typeof role.memberCount === "number"
                  ? ` · ${role.memberCount} member${role.memberCount === 1 ? "" : "s"}`
                  : ""}
              </span>
            </span>
          </SelectItem>
        ))}
        {options.length === 0 ? (
          <div className="text-muted-foreground px-3 py-2 text-sm">No roles available.</div>
        ) : null}
      </SelectContent>
    </Select>
  );
}
