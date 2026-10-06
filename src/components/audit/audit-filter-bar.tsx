"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown, Search, X } from "lucide-react";

import { AUDIT_ACTION_GROUPS } from "@/lib/audit/sentences";
import type { ActorInfo, AuditFilters } from "@/lib/audit/types";
import { hasActiveFilters } from "@/lib/audit/filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/** Debounced text input — commits 400ms after the user stops typing. */
function DebouncedSearch({
  value,
  onCommit,
  placeholder,
}: {
  value: string;
  onCommit: (value: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState(value);
  const [lastCommitted, setLastCommitted] = useState(value);

  // Adjust to URL-driven changes (filter reset, back/forward) during render —
  // the documented alternative to syncing props in an effect.
  if (lastCommitted !== value) {
    setLastCommitted(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const timer = setTimeout(() => onCommit(draft), 400);
    return () => clearTimeout(timer);
  }, [draft, value, onCommit]);

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function ActionMultiSelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (actions: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(action: string) {
    onChange(
      selected.includes(action)
        ? selected.filter((a) => a !== action)
        : [...selected, action],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between gap-2" aria-label="Filter by action type">
          <span className="truncate">
            {selected.length === 0 ? "All actions" : `${selected.length} action${selected.length === 1 ? "" : "s"}`}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-medium">Action type</p>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs font-medium text-primary hover:underline"
            >
              Clear
            </button>
          ) : null}
        </div>
        <Separator />
        <div className="max-h-72 overflow-y-auto p-2">
          {AUDIT_ACTION_GROUPS.map((group) => (
            <div key={group.id} className="mb-1">
              <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                {group.label}
              </p>
              {group.actions.map((action) => {
                const checked = selected.includes(action);
                return (
                  <button
                    key={action}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    onClick={() => toggle(action)}
                    className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                  >
                    <Checkbox checked={checked} tabIndex={-1} aria-hidden="true" />
                    <span className="font-mono text-xs">{action}</span>
                    {checked ? <Check className="ml-auto size-3.5 text-primary" /> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * Audit filter bar: text search, action-type multi-select (grouped),
 * actor picker, date presets (Today / 7d / 30d / Custom / All).
 */
export function AuditFilterBar({
  filters,
  onChange,
  actorOptions,
}: {
  filters: AuditFilters;
  onChange: (patch: Partial<AuditFilters>) => void;
  actorOptions: ActorInfo[];
}) {
  const presets: { id: AuditFilters["preset"]; label: string }[] = [
    { id: "today", label: "Today" },
    { id: "7d", label: "7d" },
    { id: "30d", label: "30d" },
    { id: "all", label: "All" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto]">
        <DebouncedSearch
          value={filters.q}
          onCommit={(q) => onChange({ q, page: 1 })}
          placeholder="Search actions, targets, IPs…"
        />
        <ActionMultiSelect
          selected={filters.actions}
          onChange={(actions) => onChange({ actions, page: 1 })}
        />
        <Select
          value={filters.actorId ?? "all"}
          onValueChange={(value) =>
            onChange({ actorId: value === "all" ? null : value, page: 1 })
          }
        >
          <SelectTrigger aria-label="Filter by actor" className="w-full lg:w-48">
            <SelectValue placeholder="All actors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {actorOptions.map((actor) => (
              <SelectItem key={actor.id} value={actor.id}>
                {actor.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Date range"
          className="flex items-center rounded-lg border p-0.5"
        >
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ preset: preset.id, page: 1 })}
              aria-pressed={filters.preset === preset.id}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                filters.preset === preset.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onChange({ preset: "custom", page: 1 })}
            aria-pressed={filters.preset === "custom"}
            className={cn(
              "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium",
              filters.preset === "custom"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarDays className="size-3.5" />
            Custom
          </button>
        </div>

        {filters.preset === "custom" ? (
          <div className="flex items-center gap-2">
            <Label htmlFor="audit-from" className="sr-only">
              From date
            </Label>
            <Input
              id="audit-from"
              type="date"
              value={filters.from ?? ""}
              onChange={(e) => onChange({ from: e.target.value || null, page: 1 })}
              className="w-auto text-xs"
            />
            <span className="text-xs text-muted-foreground">to</span>
            <Label htmlFor="audit-to" className="sr-only">
              To date
            </Label>
            <Input
              id="audit-to"
              type="date"
              value={filters.to ?? ""}
              onChange={(e) => onChange({ to: e.target.value || null, page: 1 })}
              className="w-auto text-xs"
            />
          </div>
        ) : null}

        {hasActiveFilters(filters) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({
                q: "",
                actions: [],
                actorId: null,
                preset: "all",
                from: null,
                to: null,
                page: 1,
              })
            }
            className="ml-auto"
          >
            <X className="size-3.5" />
            Reset filters
          </Button>
        ) : null}
      </div>

      {filters.actions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {filters.actions.map((action) => (
            <Badge key={action} variant="secondary" className="gap-1 font-mono text-[11px]">
              {action}
              <button
                type="button"
                aria-label={`Remove ${action} filter`}
                onClick={() =>
                  onChange({
                    actions: filters.actions.filter((a) => a !== action),
                    page: 1,
                  })
                }
                className="rounded-full hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}
