"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { safeNextPath } from "@/lib/auth/redirect-path";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Where magic-link / OAuth emails should send the user after the callback. */
function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

type Status = { kind: "error" | "info"; message: string } | null;

/**
 * Reads ?next= on the client. Must be rendered inside a <Suspense> boundary
 * (see login/page.tsx) so the /login page shell can stay prerendered.
 */
export function LoginFormWithNext() {
  const searchParams = useSearchParams();
  // Default landing is the smart redirect at / (org dashboard or onboarding).
  return <LoginForm next={safeNextPath(searchParams.get("next"), "/")} />;
}

/**
 * Sign in with Password / Magic link tabs (UI-DESIGN.md §2.2).
 */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const [pending, setPending] = useState(false);

  async function onPasswordSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      const unconfirmed = /confirm/i.test(error.message);
      setStatus({
        kind: "error",
        message: unconfirmed
          ? "This email isn't confirmed — check your inbox for the verification link, or sign up again to resend it."
          : "Invalid email or password.",
      });
      setPending(false);
      return;
    }

    router.push(safeNextPath(next));
    router.refresh();
  }

  async function onMagicSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setStatus(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(safeNextPath(next))}`,
      },
    });

    setPending(false);
    setStatus(
      error
        ? { kind: "error", message: error.message }
        : {
            kind: "info",
            message: "Check your email — we sent you a sign-in link.",
          },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="password" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="magic">Magic link</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-4">
          <form onSubmit={onPasswordSubmit} className="flex flex-col gap-4">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/reset-password?step=request"
                  className="text-sm text-muted-foreground underline-offset-4 hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={pending}
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Sign in
            </Button>
          </form>
        </TabsContent>
        <TabsContent value="magic" className="mt-4">
          <form onSubmit={onMagicSubmit} className="flex flex-col gap-4">
            <div className="grid gap-2">
              <Label htmlFor="magic-email">Email</Label>
              <Input
                id="magic-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                disabled={pending}
              />
            </div>
            <Button type="submit" disabled={pending} className="w-full">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Email me a sign-in link
            </Button>
            <p className="text-sm text-muted-foreground">
              No password needed — we&apos;ll email you a one-time link.
              <br />
              <button
                type="button"
                className="mt-1 underline underline-offset-4 hover:text-foreground"
                onClick={() =>
                  setStatus({
                    kind: "info",
                    message: "Use the Password tab above to sign in instead.",
                  })
                }
              >
                Back to password
              </button>
            </p>
          </form>
        </TabsContent>
      </Tabs>

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
    </div>
  );
}
