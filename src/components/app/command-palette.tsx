"use client";

import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export interface PaletteCommand {
  /** Stable id for React keys. */
  id: string;
  label: string;
  /** Extra search terms, e.g. "settings preferences". */
  keywords?: string;
  hint?: string;
  icon?: LucideIcon;
  /** Group heading — commands render under their group (default "Commands"). */
  group?: string;
  run: () => void;
}

/** Event name the header button dispatches to open the palette. */
export const OPEN_PALETTE_EVENT = "app:open-palette";

/**
 * cmdk command palette. Opens on ⌘K / Ctrl+K or the OPEN_PALETTE_EVENT.
 *
 * Extensible: pass more commands — clones typically add "Create X", "Go to Y",
 * and entity search results here. Keep actions synchronous-feeling: run the
 * callback, then close.
 */
export function CommandPalette({ commands }: { commands: PaletteCommand[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    function onOpenEvent() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpenEvent);
    };
  }, []);

  const groups = useCommandGroups(commands);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.name} heading={group.name}>
            {group.commands.map((command) => (
              <CommandItem
                key={command.id}
                value={`${command.label} ${command.keywords ?? ""}`.trim()}
                onSelect={() => {
                  setOpen(false);
                  command.run();
                }}
                className="cursor-pointer"
              >
                {command.icon ? <command.icon className="size-4 text-muted-foreground" /> : null}
                <span>{command.label}</span>
                {command.hint ? (
                  <kbd className="ml-auto rounded border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
                    {command.hint}
                  </kbd>
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

/** Groups commands by their `group` field, preserving first-seen order. */
function useCommandGroups(commands: PaletteCommand[]): { name: string; commands: PaletteCommand[] }[] {
  const groups: { name: string; commands: PaletteCommand[] }[] = [];
  for (const command of commands) {
    const name = command.group ?? "Commands";
    let group = groups.find((g) => g.name === name);
    if (!group) {
      group = { name, commands: [] };
      groups.push(group);
    }
    group.commands.push(command);
  }
  return groups;
}

/** Dispatch from anywhere (e.g. a header button) to open the palette. */
export function openCommandPalette() {
  window.dispatchEvent(new Event(OPEN_PALETTE_EVENT));
}
