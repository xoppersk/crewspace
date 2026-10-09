"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

type Status = { kind: "error" | "info"; message: string } | null;

/** Simple 0–4 password strength score (length, case, digit, symbol). */
function strengthScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^a-zA-Z0-9]/.test(password)) score += 1;
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too weak", "Weak", "Okay", "Good", "Strong"];

/**
 * Sign up: name, email, password (strength meter), terms checkbox
 * (UI-DESIGN.md §2.2). Success renders the check-email verification state
 * with resend + address-correction links.
 */
export function SignupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [terms, setTerms] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);

  const strength = useMemo(() => strengthScore(password), [password]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!terms) {
      setStatus({ kind: "error", message: "Please accept the terms to continue." });
      return;
    }
    setPending(true);
    setStatus(null);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent("/")}`,
      },
    });

    if (error) {
      setStatus({ kind: "error", message: error.message });
      setPending(false);
      return;
    }

    // No session + a user means email confirmation is on — the user must click
    // the link before they can sign in.
    if (data.user && !data.session) {
      setPending(false);
      setVerifyEmail(email);
      return;
    }

    router.push("/");
    router.refresh();
  }

  async function resend() {
    setPending(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email: verifyEmail ?? email });
    setPending(false);
    setStatus(
      error
        ? { kind: "error", message: error.message }
        : { kind: "info", message: "Verification email re-sent — check your inbox." },
    );
  }

  if (verifyEmail) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <div
          aria-hidden
          className="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft"
        >
          <span className="text-xl font-bold text-success">✓</span>
        </div>
        <div>
          <h2 className="text-lg font-semibold">Check your email</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            We sent a verification link to <span className="font-medium">{verifyEmail}</span>.
            Click it to finish creating your account.
          </p>
        </div>
        <Button variant="outline" onClick={resend} disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Resend verification email
        </Button>
        <button
          type="button"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setVerifyEmail(null)}
        >
          Wrong address? Correct it
        </button>
        {status ? (
          <p role={status.kind === "error" ? "alert" : "status"} className="text-sm text-muted-foreground">
            {status.message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Amara Jalloh"
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            disabled={pending}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="8+ characters"
            disabled={pending}
            aria-describedby="password-strength"
          />
          {password.length > 0 ? (
            <div id="password-strength" className="flex items-center gap-2">
              <Progress value={(strength / 4) * 100} className="h-1 flex-1" aria-hidden />
              <span className="text-xs text-muted-foreground">{STRENGTH_LABELS[strength]}</span>
            </div>
          ) : null}
        </div>
        <div className="flex items-start gap-2.5">
          <Checkbox
            id="terms"
            checked={terms}
            onCheckedChange={(checked) => setTerms(checked === true)}
            disabled={pending}
            className="mt-0.5"
          />
          <Label htmlFor="terms" className="text-sm font-normal text-muted-foreground">
            I agree to the project&apos;s terms of service and privacy policy.
          </Label>
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Create account
        </Button>
      </form>

      {status ? (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={
            status.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"
          }
        >
          {status.message}
        </p>
      ) : null}

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-foreground underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
