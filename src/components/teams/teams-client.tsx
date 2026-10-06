"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { UsersRound } from "lucide-react";

import { EmptyState } from "@/components/app/empty-state";
import { NewTeamDialog } from "./new-team-dialog";
import { TeamCard, type TeamCardData } from "./team-card";
import { cn } from "@/lib/utils";

export type TeamFilter = "all" | "active" | "archived";

/**
 * TeamsClient — All/Active/Archived filter (URL-driven) + team card grid +
 * the gated "New team" button. Archived teams collapse into their own
 * section when "All" is selected.
 */
export function TeamsClient({
  orgId,
  orgSlug,
  teams,
  canCreate,
  leadCandidates,
}: {
  orgId: string;
  orgSlug: string;
  teams: TeamCardData[];
  canCreate: boolean;
  leadCandidates: { membershipId: string; fullName: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filter = (searchParams.get("filter") ?? "all") as TeamFilter;

  const setFilter = (next: TeamFilter) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "all") params.delete("filter");
    else params.set("filter", next);
    const qs = params.toString();
    router.replace(`/${orgSlug}/teams${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const active = teams.filter((t) => !t.isArchived);
  const archived = teams.filter((t) => t.isArchived);
  const visible = filter === "active" ? active : filter === "archived" ? archived : teams;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Team status filter" className="flex rounded-md border p-0.5">
          {(
            [
              { value: "all", label: `All (${teams.length})` },
              { value: "active", label: `Active (${active.length})` },
              { value: "archived", label: `Archived (${archived.length})` },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFilter(option.value)}
              aria-pressed={filter === option.value}
              className={cn(
                "min-h-9 rounded px-3 text-sm font-medium transition-colors",
                filter === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        {canCreate ? (
          <NewTeamDialog orgId={orgId} orgSlug={orgSlug} candidates={leadCandidates} />
        ) : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={filter === "archived" ? "No archived teams" : "No teams yet"}
          description={
            filter === "archived"
              ? "Archived teams will show up here."
              : "Create your first team to group members together."
          }
          action={
            canCreate && filter !== "archived" ? (
              <NewTeamDialog orgId={orgId} orgSlug={orgSlug} candidates={leadCandidates} />
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((team) => (
            <TeamCard key={team.id} orgSlug={orgSlug} team={team} />
          ))}
        </div>
      )}
    </div>
  );
}
