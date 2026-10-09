"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  done: boolean;
  href: string;
}

/**
 * GettingStartedChecklist — progress ring with real completion state from
 * the server, dismissible (dismissal is per-browser, stored in localStorage).
 */
export function GettingStartedChecklist({
  orgId,
  items,
}: {
  orgId: string;
  items: ChecklistItem[];
}) {
  const storageKey = `crewspace:checklist-dismissed:${orgId}`;
  // Lazy initializer (SSR-safe): read the dismissal flag without an effect.
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && window.localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (dismissed || allDone) return null;

  const dismiss = () => {
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = doneCount / items.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div className="flex items-center gap-3">
          <span
            className="relative inline-flex size-14 shrink-0 items-center justify-center"
            role="img"
            aria-label={`${doneCount} of ${items.length} setup steps complete`}
          >
            <svg viewBox="0 0 64 64" className="size-14 -rotate-90" aria-hidden>
              <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="6" className="stroke-muted" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                strokeWidth="6"
                strokeLinecap="round"
                className="stroke-primary transition-[stroke-dashoffset] duration-500"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - progress)}
              />
            </svg>
            <span className="absolute text-xs font-semibold tabular-nums">
              {doneCount}/{items.length}
            </span>
          </span>
          <div>
            <CardTitle className="text-base">Getting started</CardTitle>
            <p className="text-xs text-muted-foreground">Finish setup to unlock the full workspace.</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-9 p-0"
          onClick={dismiss}
          aria-label="Dismiss getting started checklist"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col">
          {items.map((item) => (
            <li key={item.id} className="border-t py-2.5 first:border-t-0 first:pt-0">
              <Link
                href={item.href}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-md px-1 py-1",
                  item.done && "opacity-60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border",
                    item.done
                      ? "border-success bg-success text-white"
                      : "border-input text-transparent",
                  )}
                  aria-hidden
                >
                  <Check className="size-3.5" />
                </span>
                <span className="min-w-0">
                  <span className={cn("block text-sm font-medium", item.done && "line-through")}>
                    {item.label}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                <span className="sr-only">{item.done ? " (done)" : ""}</span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
