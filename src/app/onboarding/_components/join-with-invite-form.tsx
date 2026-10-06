"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * "Join with an invite" — paste a token (or the full invite link/URL) and
 * go straight to /invite/accept. Enabled now that the token flow ships.
 */
export function JoinWithInviteForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function extractToken(input: string): string {
    const trimmed = input.trim();
    if (!trimmed) return "";
    // Accept a full invite URL too — pull ?token= out of it.
    try {
      const url = new URL(trimmed);
      const token = url.searchParams.get("token");
      if (token) return token;
    } catch {
      // Not a URL — treat the whole input as the raw token.
    }
    return trimmed;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const token = extractToken(value);
    if (!token) {
      setError("Paste your invite token or link first.");
      return;
    }
    setError(null);
    router.push(`/invite/accept?token=${encodeURIComponent(token)}`);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="invite-token">Invite token or link</Label>
      <Input
        id="invite-token"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        placeholder="Paste your invite token"
        autoComplete="off"
        spellCheck={false}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" className="mt-1 min-h-11 w-full">
        Continue <ArrowRight className="size-4" />
      </Button>
      <p className="text-xs text-muted-foreground">
        Got an email invite? Open its link directly, or paste the token here.
      </p>
    </form>
  );
}
