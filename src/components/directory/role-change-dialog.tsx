"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RoleBadge } from "@/components/roles/role-badge";
import { RoleSelect, type RoleOption } from "@/components/roles/role-select";
import { cn } from "@/lib/utils";

/**
 * RoleChangeDialog — pick a new role, see the before/after permission
 * consequence, then confirm. Calls the caller's `onConfirm` (a Server Action
 * wrapper) — the server re-asserts `members:change_role` and rejects
 * self-targets regardless of what the UI shows.
 */
export function RoleChangeDialog({
  open,
  onOpenChange,
  memberName,
  currentRole,
  roles,
  onConfirm,
  title,
  description,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberName: string;
  currentRole: { id: string; name: string; systemKey: string | null; permissionCount: number };
  roles: RoleOption[];
  onConfirm: (roleId: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  title?: string;
  description?: string;
}) {
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = roles.find((r) => r.id === selectedId);
  const unchanged = !selected || selected.id === currentRole.id;

  const handleConfirm = async () => {
    if (!selected || unchanged || pending) return;
    setPending(true);
    setError(null);
    const result = await onConfirm(selected.id);
    setPending(false);
    if (result.ok) {
      setSelectedId(undefined);
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelectedId(undefined);
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? `Change ${memberName}'s role`}</DialogTitle>
          <DialogDescription>
            {description ??
              "Their permissions update on their next request, and the change is recorded in the audit log."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <RoleSelect
            roles={roles}
            value={selectedId}
            onValueChange={setSelectedId}
            excludeRoleIds={[currentRole.id]}
            placeholder="Select a new role…"
          />

          {selected ? (
            <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
              <RoleBadge roleName={currentRole.name} systemKey={currentRole.systemKey} />
              <span className="text-muted-foreground text-xs">
                {currentRole.permissionCount} permission{currentRole.permissionCount === 1 ? "" : "s"}
              </span>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <RoleBadge roleName={selected.name} systemKey={selected.systemKey} />
              <span className="text-muted-foreground text-xs">
                {selected.permissionCount} permission{selected.permissionCount === 1 ? "" : "s"}
              </span>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={unchanged || pending}
            className={cn("min-h-11 sm:min-h-9")}
          >
            {pending ? "Changing…" : "Change role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
