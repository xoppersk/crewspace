"use client";

import { useActionState } from "react";
import {
  createWorkspaceAction,
  signUpAction,
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

/** Signup step 1 — the account itself (Supabase Auth signUp). */
export function AccountForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<
    AuthFormState,
    FormData
  >(signUpAction, {});
  return (
    <form
      className="auth-form fa-form-lg"
      style={{ flex: "1 1 400px", maxWidth: 480 }}
      action={formAction}
    >
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        <label htmlFor="fn" style={labelStyle}>
          Your name
        </label>
        <input
          id="fn"
          name="fullName"
          className="in"
          autoComplete="name"
          required
          style={inputStyle}
        />
      </div>
      <div style={fieldWrap}>
        <label htmlFor="em" style={labelStyle}>
          Work email
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
      <div style={fieldWrap}>
        <label htmlFor="pw" style={labelStyle}>
          Password
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
        <span style={{ fontSize: 12.5, color: "var(--muted)" }}>
          At least 8 characters.
        </span>
      </div>
      <StateNote state={state} />
      <Button
        variant="pri"
        type="submit"
        disabled={pending}
        style={{ width: "100%", height: 46, fontSize: 14 }}
      >
        Create account
      </Button>
      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: "var(--muted)",
        }}
      >
        By continuing you agree to the <a href="#">terms</a> and{" "}
        <a href="#">privacy policy</a>.
      </p>
    </form>
  );
}

/**
 * Signup step 2 — the workspace. Submits to createWorkspaceAction,
 * which calls the create_workspace RPC (the org, the canon role
 * template and the owner's membership are created by the database).
 */
export function WorkspaceForm({
  email,
  emailDomain,
}: {
  email: string;
  emailDomain: string;
}) {
  const [state, formAction, pending] = useActionState<
    AuthFormState,
    FormData
  >(createWorkspaceAction, {});
  return (
    <form
      className="auth-form fa-form-lg"
      style={{ flex: "1 1 400px", maxWidth: 480 }}
      action={formAction}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 46,
          padding: "0 14px",
          border: "1px solid var(--seal)",
          boxShadow: "inset 0 0 0 1px var(--seal)",
          borderRadius: "var(--radius-m)",
          background: "var(--row-tint-allow)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ flex: 1, textAlign: "left" }}>{email}</span>
        <span style={{ fontSize: 12, fontWeight: 400, color: "var(--active)" }}>
          Signed in
        </span>
      </div>

      <div style={fieldWrap}>
        <label htmlFor="on" style={labelStyle}>
          Organization name
        </label>
        <input
          id="on"
          name="name"
          className="in"
          required
          placeholder="Your company or team"
          style={inputStyle}
        />
      </div>

      <div style={fieldWrap}>
        <label htmlFor="dm" style={labelStyle}>
          Work domain <span style={{ fontWeight: 400, color: "var(--muted)" }}>optional</span>
        </label>
        <input
          id="dm"
          name="domain"
          className="in mono"
          defaultValue={emailDomain}
          placeholder="company.com"
          style={{ ...inputStyle, fontSize: 14 }}
        />
        <span style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--muted)" }}>
          People on this domain can be invited as members; anyone else
          joins as a guest.
        </span>
      </div>

      <StateNote state={state} />
      <Button
        variant="pri"
        type="submit"
        disabled={pending}
        style={{ width: "100%", height: 46, fontSize: 14 }}
      >
        Create workspace
      </Button>
    </form>
  );
}
