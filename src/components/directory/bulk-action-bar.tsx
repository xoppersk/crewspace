"use client";

import { useState } from "react";
import { ShieldCheck, UsersRound, UserX, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RoleSelect, type RoleOption } from "@/components/roles/role-select";
import { bulkUpdateMembers, type BulkMemberAction } from "@/lib/members/actions";
import { summarizeBulkAction } from "@/lib/members/summaries";
import { cn } from "@/lib/utils";

import { TypeToConfirmDialog } from "./type-to-confirm-dialog";

/**
 * BulkActionBar — fixed bottom bar (desktop only) for bulk member actions:
 * change role, change team, deactivate. Each action opens a confirmation
 * summarizing the affected count; the Server Action skips self-targets and
 * the last owner, then reports how many were actually affected.
 */
export function BulkActionBar({
  orgId,
  orgSlug,
  selectedIds,
  selectedNames,
  onClear,
  roles,
  teams,
  canChangeRole,
  canDeactivate,
  canManageTeams,
}: {
  orgId: string;
  orgSlug: string;
  selectedIds: string[];
  selectedNames: string[];
  onClear: () => void;
  roles: RoleOption[];
  teams: { id: string; name: string }[];
  canChangeRole: boolean;
  canDeactivate: boolean;
  canManageTeams: boolean;
}) {
  const [roleOpen, setRoleOpen] = useState(false);
  const [teamOpen, setTeamOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);

  if (selectedIds.length === 0) return null;

  return (
    <>
      <div
        className="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-2 rounded-full border bg-background px-4 py-2 shadow-lg md:flex"
        role="toolbar"
        aria-label="Bulk member actions"
      >
        <span className="px-1 text-sm font-medium tabular-nums">
          {selectedIds.length} selected
        </span>
        {canChangeRole ? (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setRoleOpen(true)}>
            <ShieldCheck className="size-4" aria-hidden /> Change role
          </Button>
        ) : null}
        {canManageTeams ? (
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setTeamOpen(true)}>
            <UsersRound className="size-4" aria-hidden /> Change team
          </Button>
        ) : null}
        {canDeactivate ? (
          <Button
            variant="outline"
            size="sm"
            className="rounded-full text-destructive hover:text-destructive"
            onClick={() => setDeactivateOpen(true)}
          >
            <UserX className="size-4" aria-hidden /> Deactivate
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onClear} aria-label="Clear selection">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <BulkRoleDialog
        open={roleOpen}
        onOpenChange={setRoleOpen}
        orgId={orgId}
        orgSlug={orgSlug}
        selectedIds={selectedIds}
        roles={roles}
        onDone={onClear}
      />
      <BulkTeamDialog
        open={teamOpen}
        onOpenChange={setTeamOpen}
        orgId={orgId}
        orgSlug={orgSlug}
        selectedIds={selectedIds}
        teams={teams}
        onDone={onClear}
      />
      <TypeToConfirmDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title={summarizeBulkAction("deactivate", selectedIds.length).title}
        description={summarizeBulkAction("deactivate", selectedIds.length).description}
        expected={String(selectedIds.length)}
        confirmLabel="Deactivate members"
        onConfirm={async () => {
          const result = await bulkUpdateMembers(orgId, orgSlug, selectedIds, { kind: "deactivate" });
          if (result.ok) onClear();
          return result;
        }}
      />
      {/* Screen-reader list of who's affected */}
      <span className="sr-only">Selected: {selectedNames.join(", ")}</span>
    </>
  );
}

function useBulkRunner(
  orgId: string,
  orgSlug: string,
  selectedIds: string[],
  onDone: () => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: BulkMemberAction) => {
    setPending(true);
    setError(null);
    const result = await bulkUpdateMembers(orgId, orgSlug, selectedIds, action);
    setPending(false);
    if (result.ok) onDone();
    else setError(result.error);
  };
  return { pending, error, run, setError };
}

function BulkRoleDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  selectedIds,
  roles,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  selectedIds: string[];
  roles: RoleOption[];
  onDone: () => void;
}) {
  const [roleId, setRoleId] = useState<string>("");
  const { pending, error, run } = useBulkRunner(orgId, orgSlug, selectedIds, () => {
    setRoleId("");
    onOpenChange(false);
    onDone();
  });
  const roleName = roles.find((r) => r.id === roleId)?.name;
  const summary = summarizeBulkAction("change-role", selectedIds.length, roleName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{summary.title}</DialogTitle>
          <DialogDescription>{summary.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-role">New role</Label>
          <RoleSelect id="bulk-role" roles={roles} value={roleId || undefined} onValueChange={setRoleId} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => roleId && run({ kind: "change-role", roleId })}
            disabled={!roleId || pending}
            className={cn("min-h-11 sm:min-h-9")}
          >
            {pending ? "Applying…" : summary.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkTeamDialog({
  open,
  onOpenChange,
  orgId,
  orgSlug,
  selectedIds,
  teams,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  orgSlug: string;
  selectedIds: string[];
  teams: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [teamId, setTeamId] = useState<string>("");
  const { pending, error, run } = useBulkRunner(orgId, orgSlug, selectedIds, () => {
    setTeamId("");
    onOpenChange(false);
    onDone();
  });
  const teamName = teams.find((t) => t.id === teamId)?.name;
  const summary = summarizeBulkAction("change-team", selectedIds.length, teamName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{summary.title}</DialogTitle>
          <DialogDescription>{summary.description}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="bulk-team">Team</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger id="bulk-team" className="min-h-11 w-full sm:min-h-9">
              <SelectValue placeholder="Select a team…" />
            </SelectTrigger>
            <SelectContent>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={() => teamId && run({ kind: "change-team", teamId })}
            disabled={!teamId || pending}
            className={cn("min-h-11 sm:min-h-9")}
          >
            {pending ? "Applying…" : summary.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
