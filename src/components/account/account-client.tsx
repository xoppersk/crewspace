"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, LogOut, Mail, MonitorSmartphone, Trash2 } from "lucide-react";

import {
  acceptInvitation,
  changePassword,
  declineInvitation,
  deleteAccount,
  leaveOrg,
  signOutEverywhere,
} from "@/app/(app)/account/actions";
import { EmptyState } from "@/components/app/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface AccountOrg {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  roleName: string;
  memberCount: number | null;
  isActive: boolean;
}

export interface AccountInvitation {
  id: string;
  orgName: string;
  orgSlug: string;
  orgLogoUrl: string | null;
  roleName: string;
  invitedByName: string | null;
  expiresAt: string;
  message: string | null;
}

/* ---------------------------------- orgs ---------------------------------- */

function LeaveOrgButton({ org }: { org: AccountOrg }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await leaveOrg(org.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={!org.isActive}>
          <LogOut className="size-4" />
          <span className="sr-only">Leave {org.name}</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Leave {org.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            You will lose access immediately — the directory, teams, and settings will no longer
            be visible to you. Your past actions stay in the organization&apos;s audit log. If you&apos;re
            the only owner, you&apos;ll need to transfer ownership first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep my membership</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => e.preventDefault()} disabled={busy} asChild>
            <Button variant="destructive" onClick={confirm} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Leave organization
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function OrganizationList({ orgs }: { orgs: AccountOrg[] }) {
  if (orgs.length === 0) {
    return (
      <EmptyState
        title="No organizations yet"
        description="Create one or accept an invitation to get started."
      />
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {orgs.map((org) => (
        <div key={org.id} className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
          <Avatar className="size-9 rounded-md">
            {org.logoUrl ? <AvatarImage src={org.logoUrl} alt="" /> : null}
            <AvatarFallback className="rounded-md text-xs">
              {org.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{org.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {org.roleName}
              {org.memberCount !== null ? ` · ${org.memberCount} members` : ""}
            </p>
          </div>
          {!org.isActive ? <Badge variant="secondary">Deactivated</Badge> : null}
          <Button asChild variant="outline" size="sm" disabled={!org.isActive}>
            <a href={`/${org.slug}/dashboard`}>Open</a>
          </Button>
          <LeaveOrgButton org={org} />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------- invitations ------------------------------ */

export function InvitationList({ invitations }: { invitations: AccountInvitation[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function accept(invite: AccountInvitation) {
    setBusyId(invite.id);
    setError(null);
    try {
      const result = await acceptInvitation(invite.id);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.orgSlug ? `/${result.orgSlug}/dashboard` : "/");
    } finally {
      setBusyId(null);
    }
  }

  async function decline(invite: AccountInvitation) {
    setBusyId(invite.id);
    setError(null);
    try {
      const result = await declineInvitation(invite.id);
      if (!result.ok) setError(result.error);
    } finally {
      setBusyId(null);
    }
  }

  if (invitations.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No pending invitations"
        description="Invitations you receive from other organizations will appear here."
      />
    );
  }

  const expiryLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <div className="flex flex-col gap-2">
      {error ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {error}
        </p>
      ) : null}
      {invitations.map((invite) => (
        <div key={invite.id} className="flex flex-col gap-2 rounded-lg border px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar className="size-9 rounded-md">
              {invite.orgLogoUrl ? <AvatarImage src={invite.orgLogoUrl} alt="" /> : null}
              <AvatarFallback className="rounded-md text-xs">
                {invite.orgName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium">{invite.orgName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {invite.roleName}
                {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""} · expires {expiryLabel(invite.expiresAt)}
              </p>
              {invite.message ? (
                <p className="mt-1 truncate text-xs text-muted-foreground italic">
                  “{invite.message}”
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busyId !== null}
              onClick={() => decline(invite)}
            >
              {busyId === invite.id ? <Loader2 className="size-4 animate-spin" /> : null}
              Decline
            </Button>
            <Button size="sm" disabled={busyId !== null} onClick={() => accept(invite)}>
              {busyId === invite.id ? <Loader2 className="size-4 animate-spin" /> : null}
              Accept
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* --------------------------------- security -------------------------------- */

export function ChangePasswordCard() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setError(null);
    setDone(false);
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const result = await changePassword(password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(true);
      setPassword("");
      setConfirm("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Change password</CardTitle>
        <CardDescription>Takes effect immediately on all your sessions.</CardDescription>
      </CardHeader>
      <CardContent className="flex max-w-sm flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-new-password">New password</Label>
          <Input
            id="account-new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="account-confirm-password">Confirm new password</Label>
          <Input
            id="account-confirm-password"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        {done ? (
          <p className="flex items-center gap-1.5 text-sm text-success">
            <Check className="size-4" /> Password changed.
          </p>
        ) : null}
        <Button onClick={submit} disabled={busy || !password} className="w-fit">
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          Change password
        </Button>
      </CardContent>
    </Card>
  );
}

export function SessionsCard({ deviceLabel }: { deviceLabel: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await signOutEverywhere();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/sign-in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Active sessions</CardTitle>
        <CardDescription>Where you&apos;re currently signed in.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
          <MonitorSmartphone className="size-5 text-muted-foreground" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="truncate font-medium">This device</p>
            <p className="truncate text-xs text-muted-foreground">{deviceLabel}</p>
          </div>
          <Badge variant="secondary">Current</Badge>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="w-fit">
              Sign out everywhere
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of all sessions?</AlertDialogTitle>
              <AlertDialogDescription>
                This revokes every session on every device — including this one. You&apos;ll need to
                sign in again everywhere. Use this if you lost a device or suspect someone else
                is signed in as you.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => e.preventDefault()} disabled={busy} asChild>
                <Button variant="destructive" onClick={confirm} disabled={busy}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Sign out everywhere
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

/* -------------------------------- danger zone ------------------------------ */

export function DeleteAccountCard({
  email,
  soleOwnerOrgs,
}: {
  email: string;
  soleOwnerOrgs: string[];
}) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const blocked = soleOwnerOrgs.length > 0;
  const matches = confirm.trim().toLowerCase() === email.toLowerCase();

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const result = await deleteAccount(confirm);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOpen(false);
      router.push("/sign-in");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <Trash2 className="size-4" /> Danger zone
        </CardTitle>
        <CardDescription>Permanent actions — read carefully.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {blocked ? (
          <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft p-3 text-sm">
            <p className="font-semibold">You can&apos;t delete your account yet.</p>
            <p className="mt-1 text-muted-foreground">
              You&apos;re the only owner of {soleOwnerOrgs.join(", ")}. Transfer ownership of{" "}
              {soleOwnerOrgs.length === 1 ? "it" : "each"} to another member first — an
              organization can&apos;t be left without an owner.
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Deleting your account removes you from every organization, deletes your profile, and
            signs you out everywhere. This can&apos;t be undone. Your past actions stay in the
            organizations&apos; audit logs.
          </p>
        )}
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" className="w-fit" disabled={blocked}>
              Delete my account
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account permanently?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes you from every organization, deletes your profile, and signs you
                out everywhere. It can&apos;t be undone. Type your email address to confirm you
                understand.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="delete-confirm-email">Confirm with your email</Label>
              <Input
                id="delete-confirm-email"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  setError(null);
                }}
                placeholder={email}
                autoComplete="off"
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm font-medium text-destructive">
                {error}
              </p>
            ) : null}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => e.preventDefault()}
                disabled={busy || !matches}
                asChild
              >
                <Button variant="destructive" onClick={confirmDelete} disabled={busy || !matches}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Delete my account
                </Button>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
