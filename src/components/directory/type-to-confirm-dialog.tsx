"use client";

import { useState } from "react";

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
import { cn } from "@/lib/utils";

/**
 * TypeToConfirmDialog — deliberate confirmation for destructive member
 * actions. The confirm button stays disabled until the user types the
 * expected string exactly. Used by deactivate/reactivate/remove flows.
 */
export function TypeToConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  expected,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  /** Exact string the user must type. */
  expected: string;
  confirmLabel: string;
  onConfirm: () => Promise<{ ok: true } | { ok: false; error: string }>;
  destructive?: boolean;
}) {
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = typed.trim() === expected;

  const handleConfirm = async () => {
    if (!matches || pending) return;
    setPending(true);
    setError(null);
    const result = await onConfirm();
    setPending(false);
    if (result.ok) {
      setTyped("");
      onOpenChange(false);
    } else {
      setError(result.error);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setTyped("");
          setError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div>{description}</div>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="type-to-confirm">
            Type <span className="font-semibold text-foreground">“{expected}”</span> to confirm
          </Label>
          <Input
            id="type-to-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={expected}
            autoComplete="off"
            aria-invalid={typed.length > 0 && !matches}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!matches || pending}
            className={cn("min-h-11 sm:min-h-9")}
          >
            {pending ? "Working…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
