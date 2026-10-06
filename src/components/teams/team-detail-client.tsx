"use client";

import { useState } from "react";
import Link from "next/link";
import { Archive, ArchiveRestore, ChevronRight, Crown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MemberAvatar } from "@/components/directory/member-avatar";
import { archiveTeam, removeTeamMember, setTeamLead, updateTeam } from "@/lib/teams/actions";
import { archiveConfirmation } from "@/lib/teams/validation";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";

import { AddMembersPicker, type MemberCandidate } from "./add-members-picker";

export interface TeamDetailMember {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
  isLead: boolean;
}

export interface TeamActivityEntry {
  id: string;
  action: string;
  actorName: string;
  label: string;
  createdAt: string;
}

/**
 * TeamDetailClient — header (lead with change-lead control), tabs for
 * Members (scoped table + add/remove), Settings (name/description/lead/
 * archive), and Activity (audit filtered to this team).
 */
export function TeamDetailClient({
  orgId,
  orgSlug,
  team,
  members,
  candidates,
  activity,
  canManage,
  canReadAudit,
}: {
  orgId: string;
  orgSlug: string;
  team: { id: string; name: string; description: string | null; isArchived: boolean };
  members: TeamDetailMember[];
  candidates: MemberCandidate[];
  activity: TeamActivityEntry[];
  canManage: boolean;
  canReadAudit: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{team.name}</h1>
          {team.isArchived ? (
            <Badge variant="outline" className="gap-1">
              <Archive className="size-3" aria-hidden /> Archived
            </Badge>
          ) : null}
        </div>
        {team.description ? <p className="text-muted-foreground">{team.description}</p> : null}
        <p className="text-sm text-muted-foreground tabular-nums">
          {members.length} member{members.length === 1 ? "" : "s"}
        </p>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="members" className="min-h-11 sm:min-h-9">
            Members
          </TabsTrigger>
          <TabsTrigger value="settings" className="min-h-11 sm:min-h-9">
            Settings
          </TabsTrigger>
          <TabsTrigger value="activity" className="min-h-11 sm:min-h-9">
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <MembersTab
            orgId={orgId}
            orgSlug={orgSlug}
            team={team}
            members={members}
            candidates={candidates}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          {canManage ? (
            <SettingsTab orgId={orgId} orgSlug={orgSlug} team={team} members={members} />
          ) : (
            <p className="text-sm text-muted-foreground">
              You don&rsquo;t have permission to change team settings.
            </p>
          )}
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ActivityTab activity={activity} canReadAudit={canReadAudit} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MembersTab({
  orgId,
  orgSlug,
  team,
  members,
  candidates,
  canManage,
}: {
  orgId: string;
  orgSlug: string;
  team: { id: string; name: string; isArchived: boolean };
  members: TeamDetailMember[];
  candidates: MemberCandidate[];
  canManage: boolean;
}) {
  const [removing, setRemoving] = useState<TeamDetailMember | null>(null);
  const [successorId, setSuccessorId] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const successorCandidates = removing
    ? members.filter((m) => m.membershipId !== removing.membershipId)
    : [];

  const confirmRemove = async () => {
    if (!removing || pending) return;
    if (removing.isLead && successorCandidates.length > 0 && !successorId) {
      setError("Pick a successor lead first.");
      return;
    }
    setPending(true);
    setError(null);
    const result = await removeTeamMember(
      orgId,
      orgSlug,
      team.id,
      removing.membershipId,
      removing.isLead ? successorId || null : null,
    );
    setPending(false);
    if (result.ok) {
      setRemoving(null);
      setSuccessorId("");
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"}
        </h2>
        {canManage && !team.isArchived ? (
          <AddMembersPicker
            orgId={orgId}
            orgSlug={orgSlug}
            teamId={team.id}
            teamName={team.name}
            candidates={candidates}
          />
        ) : null}
      </div>

      {/* Desktop table / mobile cards */}
      <div className="hidden overflow-hidden rounded-lg border md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Member</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Role</th>
              {canManage ? <th className="w-24 px-4 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membershipId} className="border-b last:border-b-0 hover:bg-accent/50">
                <td className="px-4 py-3">
                  <Link
                    href={`/${orgSlug}/directory/${m.membershipId}`}
                    className="flex items-center gap-3 rounded focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <MemberAvatar name={m.fullName} avatarUrl={m.avatarUrl} userId={m.userId} />
                    <span>
                      <span className="flex items-center gap-2 font-medium">
                        {m.fullName}
                        {m.isLead ? (
                          <Badge variant="secondary" className="gap-1 text-[11px]">
                            <Crown className="size-3" aria-hidden /> Lead
                          </Badge>
                        ) : null}
                      </span>
                      <span className="block text-xs text-muted-foreground">{m.title ?? "No title"}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{m.title ?? "—"}</td>
                {canManage ? (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="min-h-9 text-destructive hover:text-destructive"
                      onClick={() => {
                        setRemoving(m);
                        setSuccessorId("");
                        setError(null);
                      }}
                    >
                      Remove
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {members.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">No members on this team yet.</p>
        ) : null}
      </div>

      <ul className="flex flex-col gap-2 md:hidden">
        {members.map((m) => (
          <li key={m.membershipId}>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
              <MemberAvatar name={m.fullName} avatarUrl={m.avatarUrl} userId={m.userId} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-medium">{m.fullName}</span>
                  {m.isLead ? (
                    <Badge variant="secondary" className="gap-1 shrink-0 text-[11px]">
                      <Crown className="size-3" aria-hidden /> Lead
                    </Badge>
                  ) : null}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {m.title ?? "No title"}
                </span>
              </span>
              {canManage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 shrink-0 text-destructive hover:text-destructive"
                  onClick={() => {
                    setRemoving(m);
                    setSuccessorId("");
                    setError(null);
                  }}
                >
                  Remove
                </Button>
              ) : (
                <Link
                  href={`/${orgSlug}/directory/${m.membershipId}`}
                  className="flex min-h-11 min-w-11 items-center justify-center"
                  aria-label={`View ${m.fullName}'s profile`}
                >
                  <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Remove confirmation (with successor picker when removing the lead) */}
      {removing ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Remove ${removing.fullName} from ${team.name}`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !pending && setRemoving(null)}
        >
          <div
            className="flex w-full max-w-lg flex-col gap-4 rounded-t-2xl bg-background p-6 shadow-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 className="text-lg font-semibold">Remove {removing.fullName}?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                They&rsquo;ll leave “{team.name}” but keep their organization membership and role.
              </p>
            </div>
            {removing.isLead ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="tab-successor">
                  {removing.fullName} leads this team — pick a successor
                </Label>
                <Select value={successorId} onValueChange={setSuccessorId}>
                  <SelectTrigger id="tab-successor" className="min-h-11 w-full sm:min-h-9">
                    <SelectValue placeholder="Select a successor…" />
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
                    No other members — the lead will be cleared.
                  </p>
                ) : null}
              </div>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setRemoving(null)} disabled={pending} className="min-h-11 sm:min-h-9">
                Cancel
              </Button>
              <Button variant="destructive" onClick={confirmRemove} disabled={pending} className="min-h-11 sm:min-h-9">
                {pending ? "Removing…" : "Remove from team"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SettingsTab({
  orgId,
  orgSlug,
  team,
  members,
}: {
  orgId: string;
  orgSlug: string;
  team: { id: string; name: string; description: string | null; isArchived: boolean };
  members: TeamDetailMember[];
}) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [leadId, setLeadId] = useState(
    members.find((m) => m.isLead)?.membershipId ?? "",
  );
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const dirty =
    name.trim() !== team.name || (description.trim() || null) !== (team.description ?? null);

  const handleSave = async () => {
    if (!dirty || pending) return;
    setPending(true);
    setError(null);
    setMessage(null);
    const result = await updateTeam(orgId, orgSlug, team.id, {
      name: name.trim(),
      description: description.trim() || null,
    });
    setPending(false);
    if (result.ok) setMessage("Team settings saved.");
    else setError(result.error);
  };

  const handleLeadChange = async (value: string) => {
    setLeadId(value);
    setPending(true);
    setError(null);
    const result = await setTeamLead(orgId, orgSlug, team.id, value || null);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      setLeadId(members.find((m) => m.isLead)?.membershipId ?? "");
    }
  };

  const handleArchive = async () => {
    setPending(true);
    setError(null);
    const result = await archiveTeam(orgId, orgSlug, team.id, !team.isArchived);
    setPending(false);
    setArchiveOpen(false);
    if (!result.ok) setError(result.error);
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-name">Team name</Label>
            <Input
              id="settings-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="min-h-11 sm:min-h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-description">Description</Label>
            <Textarea
              id="settings-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="settings-lead">Team lead</Label>
            <Select value={leadId} onValueChange={handleLeadChange} disabled={pending}>
              <SelectTrigger id="settings-lead" className="min-h-11 w-full sm:min-h-9">
                <SelectValue placeholder="No lead" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.membershipId} value={m.membershipId}>
                    {m.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {message ? <p className="text-sm text-emerald-700">{message}</p> : null}
          <div>
            <Button onClick={handleSave} disabled={!dirty || pending} className="min-h-11 sm:min-h-9">
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">
            {team.isArchived ? "Unarchive team" : "Archive team"}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {archiveConfirmation(team.name, members.length)}
          </p>
          <div>
            <Button
              variant={team.isArchived ? "outline" : "destructive"}
              onClick={() => setArchiveOpen(true)}
              className="min-h-11 sm:min-h-9"
            >
              {team.isArchived ? (
                <>
                  <ArchiveRestore className="size-4" aria-hidden /> Unarchive team
                </>
              ) : (
                <>
                  <Archive className="size-4" aria-hidden /> Archive team
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {archiveOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={team.isArchived ? "Unarchive team" : "Archive team"}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => !pending && setArchiveOpen(false)}
        >
          <div
            className="flex w-full max-w-lg flex-col gap-4 rounded-t-2xl bg-background p-6 shadow-lg sm:rounded-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold">
              {team.isArchived ? `Unarchive “${team.name}”?` : `Archive “${team.name}”?`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {archiveConfirmation(team.name, members.length)}
            </p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setArchiveOpen(false)} disabled={pending} className="min-h-11 sm:min-h-9">
                Cancel
              </Button>
              <Button
                variant={team.isArchived ? "default" : "destructive"}
                onClick={handleArchive}
                disabled={pending}
                className={cn("min-h-11 sm:min-h-9")}
              >
                {pending ? "Working…" : team.isArchived ? "Unarchive" : "Archive team"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActivityTab({
  activity,
  canReadAudit,
}: {
  activity: TeamActivityEntry[];
  canReadAudit: boolean;
}) {
  if (!canReadAudit) {
    return (
      <p className="text-sm text-muted-foreground">
        Team activity is part of the audit log — you don&rsquo;t have permission to view it.
      </p>
    );
  }
  if (activity.length === 0) {
    return <p className="text-sm text-muted-foreground">No recorded activity for this team yet.</p>;
  }
  return (
    <ul className="flex max-w-2xl flex-col">
      {activity.map((entry) => (
        <li
          key={entry.id}
          className="flex items-baseline justify-between gap-3 border-b py-2.5 text-sm last:border-b-0"
        >
          <span>
            <span className="font-medium">{entry.actorName}</span>{" "}
            <span className="text-muted-foreground">{entry.label}</span>
          </span>
          <span
            className="shrink-0 text-xs text-muted-foreground tabular-nums"
            title={formatAbsoluteTime(entry.createdAt)}
          >
            {formatRelativeTime(entry.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
