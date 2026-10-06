"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { Loader2, X } from "lucide-react";

import { sendInvitations, type InviteOrgContext, type SendResult } from "@/lib/invitations/actions";
import { normalizeEmail, validateInviteEmail } from "@/lib/invitations/policy";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/**
 * "Invite members" dialog (APP-FLOW Flow A): email chips, role select
 * (defaults to the org's default role), team multi-picker, personal message.
 * Server-side the action re-checks members:invite + the org invite policy.
 */
export function InviteDialog({
  open,
  onOpenChange,
  context,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: InviteOrgContext;
  onDone: (results: SendResult[]) => void;
}) {
  const [emails, setEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [roleId, setRoleId] = useState(context.defaultRoleId ?? context.roles[0]?.id ?? "");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canSubmit = useMemo(() => emails.length > 0 && roleId.length > 0 && !pending, [emails, roleId, pending]);

  function addDraft() {
    const value = draft.trim();
    if (!value) return;
    const error = validateInviteEmail(value);
    if (error) {
      setDraftError(error);
      return;
    }
    const normalized = normalizeEmail(value);
    if (emails.includes(normalized)) {
      setDraftError("That email is already on the list.");
      return;
    }
    setEmails((prev) => [...prev, normalized]);
    setDraft("");
    setDraftError(null);
  }

  function onDraftKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addDraft();
    } else if (e.key === "Backspace" && draft === "" && emails.length > 0) {
      setEmails((prev) => prev.slice(0, -1));
    }
  }

  function toggleTeam(id: string) {
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function onSubmit() {
    setPending(true);
    setSubmitError(null);
    try {
      const { sent } = await sendInvitations(context.id, {
        emails,
        roleId,
        teamIds,
        message: message.trim() || undefined,
      });
      onDone(sent);
      onOpenChange(false);
      // Reset for next use.
      setEmails([]);
      setDraft("");
      setTeamIds([]);
      setMessage("");
      setRoleId(context.defaultRoleId ?? context.roles[0]?.id ?? "");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Could not send invitations. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Invite members</DialogTitle>
          <DialogDescription>
            They&rsquo;ll get an email with a link to join {context.name}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="invite-emails">Email addresses</Label>
            <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
              {emails.map((email) => (
                <span
                  key={email}
                  className="inline-flex min-h-8 items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1.5 text-sm"
                >
                  {email}
                  <button
                    type="button"
                    aria-label={`Remove ${email}`}
                    onClick={() => setEmails((prev) => prev.filter((e) => e !== email))}
                    className="-mr-1.5 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-background"
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
              <Input
                id="invite-emails"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setDraftError(null);
                }}
                onKeyDown={onDraftKeyDown}
                onBlur={addDraft}
                placeholder={emails.length ? "Add another" : "maya@example.com"}
                className="min-h-8 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                inputMode="email"
              />
            </div>
            {draftError ? <p className="text-sm text-destructive">{draftError}</p> : null}
            <p className="text-xs text-muted-foreground">
              Press Enter after each address. Backspace removes the last one.
            </p>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="invite-role">Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id="invite-role" className="min-h-11">
                <SelectValue placeholder="Choose a role" />
              </SelectTrigger>
              <SelectContent>
                {context.roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                    {role.id === context.defaultRoleId ? " (default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {context.teams.length > 0 ? (
            <fieldset className="grid gap-1.5">
              <legend className="text-sm font-medium">Teams (optional)</legend>
              <div className="flex flex-col gap-1 rounded-md border p-1">
                {context.teams.map((team) => (
                  <label
                    key={team.id}
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={teamIds.includes(team.id)}
                      onChange={() => toggleTeam(team.id)}
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm">{team.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="invite-message">Personal message (optional)</Label>
            <Textarea
              id="invite-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Excited to have you on the team…"
              rows={2}
              maxLength={500}
            />
          </div>

          {context.allowedDomains.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              This organization only accepts {context.allowedDomains.join(", ")} addresses.
            </p>
          ) : null}

          {submitError ? (
            <Alert variant="destructive">
              <AlertDescription>{submitError}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="min-h-11">
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit} className="min-h-11">
            {pending ? <Loader2 className="size-4 animate-spin" /> : null}
            Send {emails.length > 0 ? `${emails.length} ` : ""}invitation{emails.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
