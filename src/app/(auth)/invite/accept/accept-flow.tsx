"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, LogOut, MailWarning, ShieldAlert, TimerOff } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { acceptInvitation, getInvitationByToken, type InvitationPreview } from "@/lib/invitations/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ExpiryCountdown } from "@/components/invitations/countdown";

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

/**
 * /invite/accept state machine (APP-FLOW §3, auth screens):
 *   loading → valid | different-user | new-user → success
 *           ↘ invalid | expired | revoked | already-accepted
 *
 * Never leaks whether an email is registered: token validation only ever
 * reports the token's own state; account existence is never probed.
 */
type FlowState =
  | "loading"
  | "valid"
  | "different-user"
  | "new-user"
  | "accepting"
  | "success"
  | "invalid"
  | "expired"
  | "revoked"
  | "already-accepted";

export function AcceptFlow() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [state, setState] = useState<FlowState>("loading");
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New-user inline sign-up fields.
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [signupPending, setSignupPending] = useState(false);
  const [signupInfo, setSignupInfo] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function verify() {
      if (!token) {
        setState("invalid");
        return;
      }
      try {
        const result = await getInvitationByToken(token);
        if (cancelled) return;
        if (!result.ok) {
          setState(result.reason);
          return;
        }
        setPreview(result.preview);

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) {
          setState("new-user");
        } else if (
          user.email &&
          user.email.toLowerCase() === result.preview.email.toLowerCase()
        ) {
          setState("valid");
        } else {
          setSignedInEmail(user.email ?? "another account");
          setState("different-user");
        }
      } catch {
        if (!cancelled) setState("invalid");
      }
    }
    verify();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onAccept() {
    setState("accepting");
    setError(null);
    const result = await acceptInvitation(token);
    if (result.ok) {
      setState("success");
      router.refresh();
      return;
    }
    if (result.code === "already-accepted") setState("already-accepted");
    else if (result.code === "expired") setState("expired");
    else if (result.code === "revoked") setState("revoked");
    else if (result.code === "invalid") setState("invalid");
    else {
      setError(result.message);
      setState("valid");
    }
  }

  async function onSignUp(event: FormEvent) {
    event.preventDefault();
    if (!preview) return;
    setSignupPending(true);
    setError(null);
    setSignupInfo(null);

    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: preview.email,
      password,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${appUrl()}/invite/accept?token=${encodeURIComponent(token)}`,
      },
    });

    if (signUpError) {
      setError(
        /already|registered|exists/i.test(signUpError.message)
          ? "This email already has an account. Sign in, then open your invite link again."
          : signUpError.message,
      );
      setSignupPending(false);
      return;
    }

    // Email confirmation on → no session yet: the confirmation link returns
    // here, where the signed-in user lands in the "valid" state.
    if (data.user && !data.session) {
      setSignupInfo("Check your inbox — click the confirmation link, then come back here to accept.");
      setSignupPending(false);
      return;
    }

    // Signed in immediately — accept in the same breath.
    const result = await acceptInvitation(token);
    setSignupPending(false);
    if (result.ok) {
      setState("success");
      router.refresh();
    } else if (result.code === "already-accepted") {
      setState("already-accepted");
    } else {
      setError(result.message);
    }
  }

  async function onSwitchUser() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    // After sign-out the effect re-runs as a signed-out viewer → new-user.
    setSignedInEmail(null);
    setState("new-user");
    setSigningOut(false);
  }

  if (state === "loading" || state === "accepting") {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center gap-3 py-8">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {state === "loading" ? "Verifying your invitation…" : "Accepting your invitation…"}
        </p>
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <StateBlock
        icon={<ShieldAlert className="size-6 text-muted-foreground" />}
        title="This invite link isn't valid"
        body="It may have been mistyped, or the link was copied incorrectly. Ask the person who invited you to send a fresh invitation."
      />
    );
  }

  if (state === "expired") {
    return (
      <StateBlock
        icon={<TimerOff className="size-6 text-muted-foreground" />}
        title="This invitation expired"
        body="Invitations last 7 days. Ask the person who invited you to resend it — they'll get a fresh link in one click."
      />
    );
  }

  if (state === "revoked") {
    return (
      <StateBlock
        icon={<MailWarning className="size-6 text-muted-foreground" />}
        title="This invitation was revoked"
        body="An admin withdrew this invitation. If you think this was a mistake, ask them to invite you again."
      />
    );
  }

  if (state === "already-accepted") {
    return (
      <StateBlock
        icon={<CheckCircle2 className="size-6 text-emerald-600" />}
        title="You've already accepted this invitation"
        body="You're all set — head to the workspace."
        action={
          preview ? (
            <Button asChild className="min-h-11 w-full">
              <Link href={`/${preview.orgSlug}/dashboard`}>Enter workspace</Link>
            </Button>
          ) : (
            <Button asChild className="min-h-11 w-full">
              <Link href="/">Go to your workspaces</Link>
            </Button>
          )
        }
      />
    );
  }

  if (state === "success" && preview) {
    return (
      <div className="flex flex-col items-center gap-4 py-6 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="size-7 text-emerald-600" />
        </span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Welcome to {preview.orgName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            You&rsquo;re in as <span className="font-medium text-foreground">{preview.roleName}</span>.
          </p>
        </div>
        <Button asChild className="min-h-11 w-full">
          <Link href={`/${preview.orgSlug}/dashboard`}>Enter workspace</Link>
        </Button>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div className="flex flex-col gap-5">
      {/* Org card */}
      <div className="flex items-start gap-3">
        {preview.orgLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.orgLogoUrl}
            alt={`${preview.orgName} logo`}
            className="size-12 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted text-lg font-semibold">
            {preview.orgName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">You&rsquo;ve been invited to</p>
          <h2 className="truncate text-lg font-semibold tracking-tight">{preview.orgName}</h2>
          <p className="text-sm text-muted-foreground">Invited by {preview.inviterName}</p>
        </div>
      </div>

      {/* Offered role + what it means */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Role: <span className="font-semibold">{preview.roleName}</span>
          </p>
          <ExpiryCountdown expiresAt={preview.expiresAt} />
        </div>
        {preview.roleDescription ? (
          <p className="mt-1 text-sm text-muted-foreground">{preview.roleDescription}</p>
        ) : null}
        {preview.permissionLabels.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
            {preview.permissionLabels.slice(0, 3).map((label) => (
              <li key={label} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {state === "different-user" ? (
        <div className="flex flex-col gap-3">
          <Alert>
            <AlertDescription>
              You&rsquo;re signed in as <span className="font-medium">{signedInEmail}</span>, but this
              invitation is for <span className="font-medium">{preview.email}</span>.
            </AlertDescription>
          </Alert>
          <Button onClick={onSwitchUser} disabled={signingOut} className="min-h-11 w-full">
            {signingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            Sign out and continue
          </Button>
        </div>
      ) : null}

      {state === "new-user" ? (
        <form onSubmit={onSignUp} className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Create your account to accept — it takes a few seconds.
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-email">Email</Label>
            <Input id="invite-email" value={preview.email} disabled />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-name">Your name</Label>
            <Input
              id="invite-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maya Chen"
              autoComplete="name"
              required
              minLength={2}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="invite-password">Password</Label>
            <Input
              id="invite-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password"
              autoComplete="new-password"
              required
              minLength={8}
            />
          </div>
          {signupInfo ? (
            <Alert>
              <AlertDescription>{signupInfo}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={signupPending} className="min-h-11 w-full">
            {signupPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Create account and accept
          </Button>
        </form>
      ) : null}

      {state === "valid" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            Signed in as <span className="font-medium text-foreground">{preview.email}</span>.
          </p>
          <Button onClick={onAccept} className="min-h-11 w-full">
            Accept invitation
          </Button>
        </div>
      ) : null}

      <Separator />
      <p className="text-center text-xs text-muted-foreground">
        Already have an account with a different email?{" "}
        <Link
          href={`/sign-in?next=${encodeURIComponent(`/invite/accept?token=${token}`)}`}
          className="underline underline-offset-4"
        >
          Sign in first
        </Link>
      </p>
    </div>
  );
}

function StateBlock({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-muted">{icon}</span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <p className="text-sm text-muted-foreground">{body}</p>
      {action ? <div className="mt-2 w-full">{action}</div> : null}
    </div>
  );
}
