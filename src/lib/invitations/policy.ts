import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import {
  INVITATION_TTL_DAYS,
  INVITE_CSV_HEADERS,
  INVITE_POLICIES,
  INVITE_POLICY_LABELS,
  type InvitePolicy,
} from "./constants";

// Re-exported so existing importers (`./policy`) keep working without churn.
// (policy.ts is NOT a "use server" module, so value exports are safe here.)
export {
  INVITATION_TTL_DAYS,
  INVITE_CSV_HEADERS,
  INVITE_POLICIES,
  INVITE_POLICY_LABELS,
  type InvitePolicy,
};
export { MAX_INVITES_PER_DAY } from "./constants";

/**
 * Invitation policy, tokens, state machine, and CSV helpers — pure,
 * database-free functions so every rule is unit-testable.
 * ============================================================================
 *
 * Server actions in ./actions.ts own the database; this module owns the
 * decisions (who may invite, what counts as valid, what a token means).
 */

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/**
 * Issues a fresh invitation token: 32 cryptographically random bytes rendered
 * as 64 hex chars. The RAW token goes into the email link; only the SHA-256
 * hex digest is ever stored (invitations.token_hash).
 */
export function issueInvitationToken(): { raw: string; tokenHash: string } {
  const raw = randomBytes(32).toString("hex");
  return { raw, tokenHash: hashToken(raw) };
}

/** SHA-256 hex digest of a raw token — 64 lowercase hex chars. */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Guards that a stored/derived value really looks like a SHA-256 hex digest. */
export function isSha256Hex(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

/** Expiry timestamp for a newly issued invitation. */
export function invitationExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

/** The public accept URL for a raw token — never store this, only send it. */
export function invitationAcceptUrl(rawToken: string, appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/invite/accept?token=${encodeURIComponent(rawToken)}`;
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

/** Canonical form for comparison/dedup: trimmed + lowercased. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const inviteEmailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

/** Returns an error message, or null when the email is acceptable. */
export function validateInviteEmail(email: string): string | null {
  const result = inviteEmailSchema.safeParse(email);
  return result.success ? null : result.error.issues[0]?.message ?? "Enter a valid email address.";
}

// ---------------------------------------------------------------------------
// Org invite policy (organizations.invite_policy)
// ---------------------------------------------------------------------------

/**
 * Who may invite, given the org's invite_policy and the viewer's system role
 * key (owner/admin/manager/member/viewer). Pure so the rule is testable;
 * server actions re-check it after requireOrgAccess() (layer 2), because a
 * custom role could hold members:invite while its system_key is 'member'.
 */
export function canInviteUnderPolicy(args: {
  invitePolicy: InvitePolicy;
  /** System role key of the inviter, or null for a custom-only role. */
  viewerSystemKey: string | null;
}): boolean {
  const allowedByPolicy: Record<InvitePolicy, readonly string[]> = {
    owners: ["owner"],
    admins: ["owner", "admin"],
    managers: ["owner", "admin", "manager"],
  };
  if (!args.viewerSystemKey) return false;
  return allowedByPolicy[args.invitePolicy].includes(args.viewerSystemKey);
}

/**
 * organizations.allowed_domains: empty = any domain may be invited; otherwise
 * the invitee's domain must be on the list. Comparison is case-insensitive.
 */
export function isDomainAllowed(email: string, allowedDomains: string[]): boolean {
  if (allowedDomains.length === 0) return true;
  const domain = normalizeEmail(email).split("@")[1];
  if (!domain) return false;
  const allowed = new Set(allowedDomains.map((d) => d.trim().toLowerCase()).filter(Boolean));
  return allowed.has(domain);
}

// ---------------------------------------------------------------------------
// Invitation state machine (token validation)
// ---------------------------------------------------------------------------

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

/**
 * What a raw token resolves to after lookup by token_hash:
 *  - "valid"           pending + unexpired → show the org card / accept button
 *  - "already-accepted" a replayed or double-clicked link — idempotent, not an error
 *  - "expired"         pending but past expires_at (or status already swept)
 *  - "revoked"         an admin revoked it
 *  - "invalid"         no row matched (unknown or tampered token)
 *
 * Tampered tokens never match: token_hash is the SHA-256 of the raw token,
 * so any alteration yields a different hash and a lookup miss → "invalid".
 */
export type TokenResolution = "valid" | "already-accepted" | "expired" | "revoked" | "invalid";

export function resolveInvitationState(
  row: { status: InvitationStatus; expires_at: string } | null,
  now: Date = new Date(),
): TokenResolution {
  if (!row) return "invalid";
  if (row.status === "accepted") return "already-accepted";
  if (row.status === "revoked") return "revoked";
  if (row.status === "expired") return "expired";
  return new Date(row.expires_at).getTime() <= now.getTime() ? "expired" : "valid";
}

/**
 * Cross-org guard: an invitation token belongs to exactly one org. When a
 * flow expects a specific org (e.g. a member deep-linking inside org A with
 * a token minted for org B), a mismatch must reject, never silently accept.
 */
export function assertSameOrg(invitationOrgId: string, expectedOrgId: string): boolean {
  return invitationOrgId === expectedOrgId;
}

// ---------------------------------------------------------------------------
// CSV bulk import (RFC-4180, dependency-free)
// ---------------------------------------------------------------------------

export interface CsvRowInput {
  /** 1-based line number in the file (for error messages). */
  line: number;
  email: string;
  fullName: string;
  role: string;
  team: string;
}

/**
 * Minimal RFC-4180 parser: quoted fields, embedded commas/newlines, and
 * "" escape sequences. Returns rows of fields (header included). Throws on
 * unterminated quotes.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    // Skip trailing empty line at EOF.
    if (row.length === 1 && row[0] === "" && rows.length > 0) return;
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushField();
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  if (inQuotes) throw new Error("Unterminated quoted field in CSV.");
  pushField();
  pushRow();
  return rows;
}

/**
 * Parses the raw CSV text into CsvRowInputs. Header matching is
 * case-insensitive and order-independent; unknown extra columns are ignored.
 * Missing required columns throw.
 */
export function parseInviteCsv(text: string): CsvRowInput[] {
  const rows = parseCsv(text).filter((r) => r.some((f) => f.trim() !== ""));
  if (rows.length === 0) throw new Error("The CSV file is empty.");

  const header = rows[0]!.map((h) => h.trim().toLowerCase());
  const missing = INVITE_CSV_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    throw new Error(`Missing required column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`);
  }
  const idx = (name: string) => header.indexOf(name);

  return rows.slice(1).map((fields, n) => ({
    line: n + 2,
    email: (fields[idx("email")] ?? "").trim(),
    fullName: (fields[idx("full_name")] ?? "").trim(),
    role: (fields[idx("role")] ?? "").trim(),
    team: (fields[idx("team")] ?? "").trim(),
  }));
}

export type CsvRowStatus = "valid" | "warning" | "error";

export interface CsvRowResult {
  input: CsvRowInput;
  status: CsvRowStatus;
  /** Human explanation for warning/error rows. */
  message: string | null;
  /** Resolved values for valid/warning rows. */
  email: string;
  fullName: string;
  roleId: string | null;
  teamIds: string[];
}

/**
 * Validates one CSV row against the org's roles/teams. Pure: callers supply
 * name→id maps and the set of emails already seen in the file (normalized).
 *
 *  - valid:   good email, known role/team (or blank → defaults)
 *  - warning: unknown role or team name → mapped to the org default role /
 *             dropped team, with a note shown in the review table
 *  - error:   bad/blank email, or a duplicate email in the file
 */
export function validateCsvRow(
  input: CsvRowInput,
  ctx: {
    rolesByName: Map<string, string>;
    teamsByName: Map<string, string>;
    defaultRoleId: string;
    defaultRoleName: string;
    seenEmails: Set<string>;
  },
): CsvRowResult {
  const emailError = validateInviteEmail(input.email);
  const email = normalizeEmail(input.email);

  if (!input.email || emailError) {
    return {
      input,
      status: "error",
      message: `Line ${input.line}: ${emailError ?? "Email is required."}`,
      email,
      fullName: input.fullName,
      roleId: null,
      teamIds: [],
    };
  }
  if (ctx.seenEmails.has(email)) {
    return {
      input,
      status: "error",
      message: `Line ${input.line}: ${email} appears more than once in this file.`,
      email,
      fullName: input.fullName,
      roleId: null,
      teamIds: [],
    };
  }

  const notes: string[] = [];
  let status: CsvRowStatus = "valid";

  let roleId = ctx.defaultRoleId;
  const roleKey = input.role.trim().toLowerCase();
  if (roleKey) {
    const found = ctx.rolesByName.get(roleKey);
    if (found) {
      roleId = found;
    } else {
      status = "warning";
      notes.push(`Unknown role "${input.role}" → mapped to ${ctx.defaultRoleName}.`);
    }
  }

  const teamIds: string[] = [];
  const teamKey = input.team.trim().toLowerCase();
  if (teamKey) {
    const found = ctx.teamsByName.get(teamKey);
    if (found) {
      teamIds.push(found);
    } else {
      status = "warning";
      notes.push(`Unknown team "${input.team}" → invite sent without a team.`);
    }
  }

  return {
    input,
    status,
    message: notes.length > 0 ? `Line ${input.line}: ${notes.join(" ")}` : null,
    email,
    fullName: input.fullName,
    roleId,
    teamIds,
  };
}

/** Builds the downloadable template content. */
export function inviteCsvTemplate(): string {
  return `${INVITE_CSV_HEADERS.join(",")}\nmaya@example.com,Maya Chen,Member,Design\nluis@example.com,Luis Gomez,,\n`;
}

// ---------------------------------------------------------------------------
// Expiry countdown formatting (plain language, DESIGN-BRIEF voice)
// ---------------------------------------------------------------------------

/** "Expires in 6d", "Expires in 3h", "Expires in 12m", "Expired". */
export function formatExpiryCountdown(expiresAt: string, now: Date = new Date()): string {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  if (ms <= 0) return "Expired";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `Expires in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Expires in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `Expires in ${days}d`;
}

/** True when the expiry chip should render in the warning (red) state. */
export function isExpiryUrgent(expiresAt: string, now: Date = new Date()): boolean {
  const ms = new Date(expiresAt).getTime() - now.getTime();
  return ms > 0 && ms < 24 * 60 * 60 * 1000;
}
