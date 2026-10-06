"use client";

import { useMemo, useState } from "react";
import { Check, Plus, Search } from "lucide-react";

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
import { MemberAvatar } from "@/components/directory/member-avatar";
import { addTeamMembers } from "@/lib/teams/actions";
import { cn } from "@/lib/utils";

export interface MemberCandidate {
  membershipId: string;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  title: string | null;
}

/**
 * AddMembersPicker — dialog with search + multi-select over org members not
 * yet on the team. Gated on `teams:manage` by the caller; the Server Action
 * re-asserts and de-dupes.
 */
export function AddMembersPicker({
  orgId,
  orgSlug,
  teamId,
  teamName,
  candidates,
}: {
  orgId: string;
  orgSlug: string;
  teamId: string;
  teamName: string;
  candidates: MemberCandidate[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        (c.title ?? "").toLowerCase().includes(q),
    );
  }, [candidates, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selected.size === 0 || pending) return;
    setPending(true);
    setError(null);
    const result = await addTeamMembers(orgId, orgSlug, teamId, [...selected]);
    setPending(false);
    if (result.ok) {
      setAdded(result.added);
      setSelected(new Set());
      setQuery("");
      if (result.added === 0) setOpen(false);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSelected(new Set());
          setQuery("");
          setError(null);
          setAdded(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button className="min-h-11 sm:min-h-9">
          <Plus className="size-4" aria-hidden /> Add members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Add members to {teamName}</DialogTitle>
          <DialogDescription>
            {added !== null && added > 0
              ? `${added} member${added === 1 ? "" : "s"} added.`
              : "Search the organization and select members to add."}
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search members…"
            aria-label="Search members to add"
            className="min-h-11 pl-9 sm:min-h-9"
          />
        </div>

        <ul className="-mx-1 max-h-72 flex-1 overflow-y-auto px-1" aria-label="Members">
          {filtered.map((c) => {
            const isSelected = selected.has(c.membershipId);
            return (
              <li key={c.membershipId}>
                <button
                  type="button"
                  onClick={() => toggle(c.membershipId)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-12 w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-accent",
                    isSelected && "bg-accent",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded border",
                      isSelected ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                    aria-hidden
                  >
                    {isSelected ? <Check className="size-3.5" /> : null}
                  </span>
                  <MemberAvatar
                    name={c.fullName}
                    avatarUrl={c.avatarUrl}
                    userId={c.userId}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{c.fullName}</span>
                    {c.title ? (
                      <span className="block truncate text-xs text-muted-foreground">{c.title}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">
              {candidates.length === 0
                ? "Everyone is already on this team."
                : "No members match your search."}
            </li>
          ) : null}
        </ul>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <span className="mr-auto self-center text-sm text-muted-foreground tabular-nums">
            {selected.size} selected
          </span>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            {added ? "Done" : "Cancel"}
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selected.size === 0 || pending}
            className={cn("min-h-11 sm:min-h-9")}
          >
            {pending ? "Adding…" : `Add ${selected.size > 0 ? `${selected.size} ` : ""}member${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
