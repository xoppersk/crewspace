"use client";

import { useActionState } from "react";
import {
  forgotPasswordAction,
  updatePasswordAction,
  type AuthFormState,
} from "@/lib/auth/actions";
import { Button } from "@/components/Button";

const fieldWrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 7,
};
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600 };
const inputStyle: React.CSSProperties = {
  height: 44,
  width: "100%",
  fontSize: 15,
};

function StateNote({ state }: { state: AuthFormState }) {
  if (state.error) {
    return (
      <p role="alert" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--deny)" }}>
        {state.error}
      </p>
    );
  }
  if (state.notice) {
    return (
      <p role="status" style={{ margin: 0, fontSize: 13.5, lineHeight: 1.55 }}>
        {state.notice}
      </p>
    );
  }
  return null;
}

/** Step 1 — ask Supabase to email a recovery link. */
export function RequestResetForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState,
    FormData
  >(forgotPasswordAction, {});
  return (
    <form className="auth-form fa-form" action={formAction}>
      <div style={fieldWrap}>
        <label htmlFor="em" style={labelStyle}>
          Email
        </label>
        <input
          id="em"
          name="email"
          className="in"
          type="email"
          autoComplete="email"
          required
          placeholder="you@company.com"
          style={inputStyle}
        />
      </div>
      <StateNote state={state} />
      <Button
        variant="pri"
        type="submit"
        disabled={pending}
        style={{ width: "100%", height: 46, fontSize: 14 }}
      >
        Email me a reset link
      </Button>
    </form>
  );
}

/** Step 2 — arrived via the recovery link (session exists): set the
    new password with updateUser. */
export function SetPasswordForm() {
  const [state, formAction, pending] = useActionState<
    AuthFormState,
    FormData
  >(updatePasswordAction, {});
  return (
    <form className="auth-form fa-form" action={formAction}>
      <div style={fieldWrap}>
        <label htmlFor="pw" style={labelStyle}>
          New password
        </label>
        <input
          id="pw"
          name="password"
          className="in"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          style={inputStyle}
        />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="pw2" style={labelStyle}>
          Type it again
        </label>
        <input
          id="pw2"
          name="confirm"
          className="in"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          style={inputStyle}
        />
      </div>
      <StateNote state={state} />
      <Button
        variant="pri"
        type="submit"
        disabled={pending}
        style={{ width: "100%", height: 46, fontSize: 14 }}
      >
        Set password and sign in
      </Button>
    </form>
  );
}
