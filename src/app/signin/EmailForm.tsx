"use client";

import { useActionState, type CSSProperties, type ReactNode } from "react";
import { signInAction, type AuthFormState } from "@/lib/auth/actions";

/**
 * Real sign-in form: email + password through signInAction
 * (signInWithPassword). Errors come back from Supabase Auth verbatim.
 * `next` (a same-site path, e.g. an invite link) rides along hidden.
 */
export function EmailForm({
  className,
  style,
  next,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  next?: string;
  children: ReactNode;
}) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(
    signInAction,
    {},
  );

  return (
    <form className={className} style={style} action={formAction}>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {children}
      {state.error ? (
        <p
          role="alert"
          style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--deny)" }}
        >
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
