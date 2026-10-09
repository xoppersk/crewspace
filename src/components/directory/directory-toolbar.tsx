"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Check, ChevronDown, LayoutGrid, Search, Table2, Wifi } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePresence } from "@/components/presence/presence-provider";
import { cn } from "@/lib/utils";

/**
 * DirectoryToolbar — search (debounced 200ms → server query via URL),
 * filter chips (Team, Role, Status, Online now), sort select, and the live
 * "n online" count. All state lives in the URL so the server component
 * re-queries on every change.
 */
export function DirectoryToolbar({
  teams,
  roles,
  resultSummary,
}: {
  teams: { id: string; name: string }[];
  roles: { id: string; name: string }[];
  /** e.g. "24 members" — rendered next to the online count. */
  resultSummary: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { onlineCount } = usePresence();

  const q = searchParams.get("q") ?? "";
  const team = searchParams.get("team") ?? "all";
  const role = searchParams.get("role") ?? "all";
  const status = searchParams.get("status") ?? "all";
  const online = searchParams.get("online") === "1";
  const sort = searchParams.get("sort") ?? "name";
  const view = searchParams.get("view") === "cards" ? "cards" : "table";

  const [draft, setDraft] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust during render (not in an effect): when the URL changes from
  // elsewhere (e.g. the back button), reset the input to match.
  const [lastQ, setLastQ] = useState(q);
  if (q !== lastQ) {
    setLastQ(q);
    setDraft(q);
  }

  const push = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") next.delete(key);
      else next.set(key, value);
    }
    next.delete("page"); // filters reset pagination
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const onSearchChange = (value: string) => {
    setDraft(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => push({ q: value.trim() || null }), 200);
  };

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const teamName = teams.find((t) => t.id === team)?.name;
  const roleName = roles.find((r) => r.id === role)?.name;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={draft}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name or title…"
            aria-label="Search members"
            className="min-h-11 pl-9 sm:min-h-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => push({ sort: v })}>
          <SelectTrigger className="min-h-11 w-full sm:min-h-9 sm:w-44" aria-label="Sort members">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Name</SelectItem>
            <SelectItem value="recent">Recently active</SelectItem>
            <SelectItem value="newest">Newest</SelectItem>
          </SelectContent>
        </Select>
        {/* View toggle — desktop only (UI-DESIGN.md §2.7) */}
        <div
          role="group"
          aria-label="Directory layout"
          className="hidden rounded-md border p-0.5 md:flex"
        >
          {(
            [
              { value: "table", label: "Table", icon: Table2 },
              { value: "cards", label: "Cards", icon: LayoutGrid },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => push({ view: option.value === "table" ? null : option.value })}
              aria-pressed={view === option.value}
              aria-label={`${option.label} view`}
              title={`${option.label} view`}
              className={cn(
                "flex min-h-9 items-center rounded px-2.5 transition-colors",
                view === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <option.icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Status segmented control */}
        <div
          role="group"
          aria-label="Status filter"
          className="flex rounded-md border p-0.5"
        >
          {(
            [
              { value: "all", label: "All" },
              { value: "active", label: "Active" },
              { value: "deactivated", label: "Deactivated" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => push({ status: option.value })}
              aria-pressed={status === option.value}
              className={cn(
                "min-h-9 rounded px-3 text-sm font-medium transition-colors",
                status === option.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <FilterPopover
          label="Team"
          activeLabel={teamName}
          onClear={() => push({ team: null })}
        >
          <FilterList
            items={[{ id: "all", name: "All teams" }, ...teams]}
            activeId={team}
            onSelect={(id) => push({ team: id })}
          />
        </FilterPopover>

        <FilterPopover
          label="Role"
          activeLabel={roleName}
          onClear={() => push({ role: null })}
        >
          <FilterList
            items={[{ id: "all", name: "All roles" }, ...roles]}
            activeId={role}
            onSelect={(id) => push({ role: id })}
          />
        </FilterPopover>

        <button
          type="button"
          onClick={() => push({ online: online ? null : "1" })}
          aria-pressed={online}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors",
            online
              ? "border-success/50 bg-success-soft text-success  "
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Wifi className="size-3.5" aria-hidden />
          Online now
        </button>

        <span className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success" aria-hidden />
            {onlineCount} online
          </span>
          <span aria-hidden>·</span>
          <span>{resultSummary}</span>
        </span>
      </div>
    </div>
  );
}

function FilterPopover({
  label,
  activeLabel,
  onClear,
  children,
}: {
  label: string;
  activeLabel?: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const active = !!activeLabel;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("min-h-9 gap-1.5 rounded-full", active && "border-primary/50")}
          aria-label={`Filter by ${label}${activeLabel ? `: ${activeLabel}` : ""}`}
        >
          {activeLabel ?? label}
          {active ? (
            <span
              role="button"
              tabIndex={0}
              aria-label={`Clear ${label} filter`}
              className="ml-0.5 rounded-full px-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onClear();
                }
              }}
            >
              ✕
            </span>
          ) : (
            <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-1"
        align="start"
        onSelect={() => setOpen(false)}
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function FilterList({
  items,
  activeId,
  onSelect,
}: {
  items: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ul className="max-h-64 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item.id)}
            className={cn(
              "flex min-h-11 w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-accent sm:min-h-9",
              item.id === activeId && "font-medium",
            )}
            aria-current={item.id === activeId}
          >
            <span className="truncate">{item.name}</span>
            {item.id === activeId ? (
              <Check className="size-4 shrink-0 text-primary" aria-hidden />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function OnlineBadge({ count }: { count: number }) {
  return (
    <Badge variant="outline" className="gap-1.5 border-success/40">
      <span className="size-1.5 rounded-full bg-success" aria-hidden />
      {count} online
      <span className="sr-only">members currently online</span>
    </Badge>
  );
}
