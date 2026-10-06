"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { createTeam } from "@/lib/teams/actions";
import { cn } from "@/lib/utils";

/**
 * NewTeamDialog — gated on `teams:create` by the caller (the button isn't
 * rendered without it); the Server Action re-asserts.
 */
export function NewTeamDialog({
  orgId,
  orgSlug,
  candidates,
}: {
  orgId: string;
  orgSlug: string;
  /** Active org members eligible to lead. */
  candidates: { membershipId: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [leadId, setLeadId] = useState<string>("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim().length >= 2 && name.trim().length <= 60;

  const handleCreate = async () => {
    if (!valid || pending) return;
    setPending(true);
    setError(null);
    const result = await createTeam(orgId, orgSlug, {
      name: name.trim(),
      description: description.trim() || undefined,
      leadMembershipId: leadId || undefined,
    });
    setPending(false);
    if (result.ok) {
      setOpen(false);
      setName("");
      setDescription("");
      setLeadId("");
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-9">
          <Plus className="size-4" aria-hidden /> New team
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a team</DialogTitle>
          <DialogDescription>
            Teams group members for directory filters and the team picker. You can add members
            right after creating it.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">Team name</Label>
            <Input
              id="team-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Design"
              maxLength={60}
              className="min-h-11 sm:min-h-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-description">Description (optional)</Label>
            <Textarea
              id="team-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this team do?"
              maxLength={280}
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-lead">Team lead (optional)</Label>
            <Select value={leadId} onValueChange={setLeadId}>
              <SelectTrigger id="team-lead" className="min-h-11 w-full sm:min-h-9">
                <SelectValue placeholder="No lead yet" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((c) => (
                  <SelectItem key={c.membershipId} value={c.membershipId}>
                    {c.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The lead is added to the team automatically.
            </p>
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!valid || pending} className={cn("min-h-11 sm:min-h-9")}>
            {pending ? "Creating…" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
