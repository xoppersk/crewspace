"use client";

import { useState } from "react";
import { Crown, Plus, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
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
import { addTeamMembers, removeTeamMember } from "@/lib/teams/actions";
import { validateLeadRemoval } from "@/lib/teams/validation";
import { cn } from "@/lib/utils";

export interface MemberTeamEntry {
  id: string;
  name: string;
  isLead: boolean;
}

export interface TeamMemberEntry {
  membershipId: string;
  fullName: string;
}

/**
 * MemberTeamsEditor — the member's team list with add/remove controls.
 * Add/remove are gated on `teams:manage` (layer 1); the Server Actions
 * re-assert server-side (layer 2). Removing a lead opens the successor
 * picker — enforced again in `removeTeamMember` via `validateLeadRemoval`.
 */
export function MemberTeamsEditor({
  orgId,
  orgSlug,
  membershipId,
  memberName,
  teams,
  allTeams,
  teamMembers,
  canManage,
}: {
  orgId: string;
  orgSlug: string;
  membershipId: string;
  memberName: string;
  teams: MemberTeamEntry[];
  allTeams: { id: string; name: string }[];
  teamMembers: Record<string, TeamMemberEntry[]>;
  canManage: boolean;
}) {
  const [addTeamId, setAddTeamId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successorFor, setSuccessorFor] = useState<MemberTeamEntry | null>(null);
  const [successorId, setSuccessorId] = useState<string>("");

  const joinable = allTeams.filter((t) => !teams.some((m) => m.id === t.id));

  const handleAdd = async () => {
    if (!addTeamId || pending) return;
    setPending(true);
    setError(null);
    const result = await addTeamMembers(orgId, orgSlug, addTeamId, [membershipId]);
    setPending(false);
    if (!result.ok) setError(result.error);
    else setAddTeamId("");
  };

  const handleRemove = async (team: MemberTeamEntry, successor?: string | null) => {
    setPending(true);
    setError(null);
    const result = await removeTeamMember(orgId, orgSlug, team.id, membershipId, successor ?? null);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
    } else {
      setSuccessorFor(null);
      setSuccessorId("");
    }
  };

  const requestRemove = (team: MemberTeamEntry) => {
    if (!team.isLead) {
      void handleRemove(team);
      return;
    }
    // Lead removal: the pure validator decides whether a successor is needed.
    const remaining = (teamMembers[team.id] ?? [])
      .filter((m) => m.membershipId !== membershipId)
      .map((m) => m.membershipId);
    const check = validateLeadRemoval({
      teamLeadMembershipId: membershipId,
      removingMembershipId: membershipId,
      successorMembershipId: null,
      remainingMemberIds: remaining,
      teamName: team.name,
      memberName,
    });
    if (!check.ok) {
      setSuccessorFor(team); // opens the successor picker
    } else {
      void handleRemove(team);
    }
  };

  const successorCandidates = successorFor
    ? (teamMembers[successorFor.id] ?? []).filter((m) => m.membershipId !== membershipId)
    : [];

  return (
    <div className="flex flex-col gap-3">
      {teams.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not on any teams yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {teams.map((team) => (
            <li
              key={team.id}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate font-medium">{team.name}</span>
                {team.isLead ? (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <Crown className="size-3" aria-hidden /> Lead
                  </Badge>
                ) : null}
              </span>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 shrink-0 p-0 sm:h-8 sm:w-8"
                  onClick={() => requestRemove(team)}
                  disabled={pending}
                  aria-label={`Remove ${memberName} from ${team.name}`}
                >
                  <X className="size-4" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {canManage && joinable.length > 0 ? (
        <div className="flex gap-2">
          <Select value={addTeamId} onValueChange={setAddTeamId}>
            <SelectTrigger className="min-h-11 flex-1 sm:min-h-9" aria-label="Add to team">
              <SelectValue placeholder="Add to a team…" />
            </SelectTrigger>
            <SelectContent>
              {joinable.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleAdd} disabled={!addTeamId || pending} className="min-h-11 sm:min-h-9">
            <Plus className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only sm:inline">Add</span>
          </Button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Successor picker for lead removal */}
      <Dialog
        open={successorFor !== null}
        onOpenChange={(next) => {
          if (!next) {
            setSuccessorFor(null);
            setSuccessorId("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pick a successor lead</DialogTitle>
            <DialogDescription>
              {memberName} leads “{successorFor?.name}”. Choose who takes over before removing
              them from the team.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="successor">Successor lead</Label>
            <Select value={successorId} onValueChange={setSuccessorId}>
              <SelectTrigger id="successor" className="min-h-11 w-full sm:min-h-9">
                <SelectValue placeholder="Select a team member…" />
              </SelectTrigger>
              <SelectContent>
                {successorCandidates.map((m) => (
                  <SelectItem key={m.membershipId} value={m.membershipId}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {successorCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No other members on this team — the lead will be cleared.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuccessorFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => successorFor && handleRemove(successorFor, successorId || null)}
              disabled={pending || (successorCandidates.length > 0 && !successorId)}
              className={cn("min-h-11 sm:min-h-9")}
            >
              {pending ? "Removing…" : "Remove and reassign lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
