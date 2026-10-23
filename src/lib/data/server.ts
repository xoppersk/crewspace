import "server-only";

import { cache } from "react";

import type { WorkspaceData } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import type {
  AuditEntry,
  AuditKind,
  Invitation,
  Member,
  NeedsOwnerItem,
  Org,
  Permission,
  Role,
  Setting,
  Team,
} from "@/lib/types";
import {
  APP_LAYER_PERMISSION_IDS,
  APP_LAYER_PERMISSION_META,
  BASELINE_PERMISSION_IDS,
  PERMISSION_GROUPS,
  PERMISSION_ORDER,
  permissionIdForKey,
  permissionKeyForId,
} from "./permissions";

/**
 * Server data layer — every read is scoped to the signed-in user's
 * active workspace and runs under RLS with the user's own session.
 * ==========================================================================
 * getActiveWorkspace(): the user's memberships, deterministic order —
 * active memberships first, then earliest joined. v2 routes carry no
 * org slug, so this membership IS the workspace resolution.
 *
 * Contract objects (Worker S, production/WORKER-S-SCHEMA.md):
 * create_workspace RPC for signup; role_permission_changes (00019)
 * for register drafts; organizations.seat_price_cents (00018) for the
 * per-seat price; roles.reg_number / teams.reg_number / teams.is_unlisted
 * (00018) for display numbers; invitations carry 'bounced' as
 * status='pending' with the bounce noted in `message`.
 */

export interface ActiveWorkspace {
  userId: string;
  userEmail: string;
  orgId: string;
  membershipId: string;
  roleId: string;
  isActive: boolean;
}

export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getActiveWorkspace = cache(
  async (): Promise<ActiveWorkspace | null> => {
    const user = await getCurrentUser();
    if (!user) return null;
    const supabase = await createClient();
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, org_id, role_id, is_active, joined_at")
      .eq("user_id", user.id)
      .order("joined_at", { ascending: true });
    if (!memberships?.length) return null;
    const chosen = memberships.find((m) => m.is_active) ?? memberships[0]!;
    return {
      userId: user.id,
      userEmail: user.email ?? "",
      orgId: chosen.org_id,
      membershipId: chosen.id,
      roleId: chosen.role_id,
      isActive: chosen.is_active,
    };
  },
);

/**
 * The session gate for /app/** — every state derives from the real
 * session + the user's own membership rows:
 *   signed-out  → no auth user
 *   no-org      → auth user with no membership anywhere
 *   deactivated → the user's (chosen) membership is inactive
 *   active      → workspace data loaded
 */
export type GateState =
  | { kind: "signed-out" }
  | { kind: "no-org"; email: string }
  | {
      kind: "deactivated";
      email: string;
      orgName: string;
      deactivatedBy?: string;
      deactivatedOn?: string;
      roleName?: string;
    }
  | { kind: "active"; ws: ActiveWorkspace; data: WorkspaceData };

export const getGateState = cache(async (): Promise<GateState> => {
  const user = await getCurrentUser();
  if (!user) return { kind: "signed-out" };
  const ws = await getActiveWorkspace();
  if (!ws) return { kind: "no-org", email: user.email ?? "" };
  if (ws.isActive) {
    const data = await loadWorkspaceData();
    if (data) return { kind: "active", ws, data };
    return { kind: "no-org", email: user.email ?? "" };
  }
  // Deactivated: read what RLS lets the user see about their own
  // membership (own row is visible); org/role names are best-effort.
  const supabase = await createClient();
  const [{ data: org }, { data: membership }, { data: role }] =
    await Promise.all([
      supabase.from("organizations").select("name").eq("id", ws.orgId).maybeSingle(),
      supabase
        .from("memberships")
        .select("deactivated_at, deactivated_by")
        .eq("id", ws.membershipId)
        .maybeSingle(),
      supabase.from("roles").select("name").eq("id", ws.roleId).maybeSingle(),
    ]);
  let deactivatedBy: string | undefined;
  if (membership?.deactivated_by) {
    const { data: byProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", membership.deactivated_by)
      .maybeSingle();
    deactivatedBy = byProfile?.full_name || undefined;
  }
  return {
    kind: "deactivated",
    email: user.email ?? "",
    orgName: org?.name ?? "this workspace",
    deactivatedBy,
    deactivatedOn: membership?.deactivated_at
      ? fmtMonthDay(membership.deactivated_at)
      : undefined,
    roleName: role?.name,
  };
});

/**
 * Page helper: workspace data only when the session gate is ACTIVE.
 * Pages render <AppShell>{null}</AppShell> on null and let the shell
 * present the real no-org / deactivated state instead.
 */
export const loadActiveWorkspaceData = cache(
  async (): Promise<WorkspaceData | null> => {
    const ws = await getActiveWorkspace();
    if (!ws?.isActive) return null;
    return loadWorkspaceData();
  },
);

/** The actor's effective DB permission keys in this workspace (RPC). */
export async function getMyPermissionKeys(orgId: string): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("user_permissions", {
    p_org_id: orgId,
    p_user_id: user.id,
  });
  return data ?? [];
}

/** Server-side permission check (RPC has_permission) — call BEFORE any
    mutating write, in addition to RLS. */
export async function checkPermission(
  orgId: string,
  key: string,
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_permission", {
    p_org_id: orgId,
    p_key: key,
  });
  return data === true;
}

/** Append an audit entry for a consequential action taken in this app.
    RLS allows inserts by org members; failures are swallowed so an
    audit hiccup never blocks the action it describes — but the entry
    is written in the same request, before the response returns. */
export async function appendAudit(entry: {
  orgId: string;
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  summary: string;
  detail?: string;
}): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from("audit_log").insert({
      org_id: entry.orgId,
      actor_id: entry.actorId,
      action: entry.action,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      target_label: entry.targetLabel ?? null,
      metadata: { summary: entry.summary, detail: entry.detail ?? null },
    });
  } catch {
    // Append-only trail: never let an audit failure mask the action.
  }
}

/* ------------------------------------------------------------------ */
/* Formatting helpers (DB timestamps → the register's display strings) */
/* ------------------------------------------------------------------ */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtMonthDay(iso: string): string {
  const d = new Date(iso);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`;
}

function fmtDayFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;
}

function fmtLastActive(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  if (now.getTime() - d.getTime() < 5 * 60 * 1000) return "Now";
  if (d.toDateString() === now.toDateString()) return "Today";
  return fmtMonthDay(iso);
}

/** "priya.shah@…" → "Priya Shah" — display derivation for invitations,
    which carry no name until the invitee signs up. */
function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (!parts.length) return email;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

function auditKind(action: string): AuditKind {
  if (action.includes("sign")) return "sign-in";
  if (action.includes("invit")) return "invitation";
  if (action.includes("team")) return "team";
  if (action.includes("review")) return "review";
  if (action.includes("org") || action.includes("setting")) return "settings";
  return "access";
}

/* ------------------------------------------------------------------ */
/* The workspace load                                                  */
/* ------------------------------------------------------------------ */

export const loadWorkspaceData = cache(
  async (): Promise<WorkspaceData | null> => {
    const ws = await getActiveWorkspace();
    if (!ws) return null;
    const supabase = await createClient();
    const orgId = ws.orgId;

    const [orgRes, permRes, rolesRes, membersRes, teamsRes, invRes, auditRes, changesRes] =
      await Promise.all([
        supabase.from("organizations").select("*").eq("id", orgId).single(),
        supabase.from("permissions").select("*"),
        supabase.from("roles").select("*").eq("org_id", orgId).order("created_at"),
        supabase
          .from("memberships")
          .select("*")
          .eq("org_id", orgId)
          .order("joined_at", { ascending: true }),
        supabase.from("teams").select("*").eq("org_id", orgId).order("created_at"),
        supabase
          .from("invitations")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("*")
          .eq("org_id", orgId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("role_permission_changes")
          .select("*")
          .eq("org_id", orgId)
          .eq("status", "pending"),
      ]);

    if (!orgRes.data) return null;
    const orgRow = orgRes.data;
    const membershipRows = membersRes.data ?? [];
    const roleRows = rolesRes.data ?? [];
    const teamRows = teamsRes.data ?? [];

    const [profilesRes, teamMembersRes, grantsRes, deniesRes] = await Promise.all([
      membershipRows.length
        ? supabase
            .from("profiles")
            .select("*")
            .in("id", membershipRows.map((m) => m.user_id))
        : Promise.resolve({ data: [] as never[] }),
      teamRows.length
        ? supabase
            .from("team_memberships")
            .select("*")
            .in("team_id", teamRows.map((t) => t.id))
        : Promise.resolve({ data: [] as never[] }),
      roleRows.length
        ? supabase
            .from("role_permissions")
            .select("*")
            .in("role_id", roleRows.map((r) => r.id))
        : Promise.resolve({ data: [] as never[] }),
      roleRows.length
        ? supabase
            .from("role_permission_denies")
            .select("*")
            .in("role_id", roleRows.map((r) => r.id))
        : Promise.resolve({ data: [] as never[] }),
    ]);

    const profiles = new Map(
      (profilesRes.data ?? []).map((p) => [p.id, p] as const),
    );
    const profileName = (userId: string) =>
      profiles.get(userId)?.full_name ||
      nameFromEmail(profiles.get(userId)?.email ?? "");

    /* ---- permissions (register order 1–18; 12/14/16 app-layer) ---- */
    const catalog = new Map(
      (permRes.data ?? []).map((p) => [p.key, p] as const),
    );
    const permissions: Permission[] = PERMISSION_ORDER.map((key, i) => {
      const row = key ? catalog.get(key) : undefined;
      const meta = APP_LAYER_PERMISSION_META[i + 1];
      return {
        id: i + 1,
        group:
          PERMISSION_GROUPS.find((g) => g.permissionIds.includes(i + 1))
            ?.name ?? "",
        name: row?.label ?? meta?.name ?? "",
        description: row?.description ?? meta?.description ?? "",
      };
    });

    /* ---- roles ---- */
    const grantsByRole = new Map<string, Set<string>>();
    for (const g of grantsRes.data ?? []) {
      if (!grantsByRole.has(g.role_id)) grantsByRole.set(g.role_id, new Set());
      grantsByRole.get(g.role_id)!.add(g.permission_key);
    }
    const deniesByRole = new Map<string, Set<string>>();
    for (const d of deniesRes.data ?? []) {
      if (!deniesByRole.has(d.role_id)) deniesByRole.set(d.role_id, new Set());
      deniesByRole.get(d.role_id)!.add(d.permission_key);
    }
    // Pending (draft) register changes — role_permission_changes (00019).
    const pendingByRole = new Map<
      string,
      { permissionId: number; from: Setting; to: Setting; changeId: string }[]
    >();
    for (const c of changesRes.data ?? []) {
      const pid = permissionIdForKey(c.permission_key);
      if (!pid) continue;
      const list = pendingByRole.get(c.role_id) ?? [];
      list.push({
        permissionId: pid,
        from: c.from_state,
        to: c.to_state,
        changeId: c.id,
      });
      pendingByRole.set(c.role_id, list);
    }

    const roleUiId = (r: (typeof roleRows)[number]) => r.system_key ?? r.id;
    const roles: Role[] = roleRows.map((r, idx) => {
      const grants = grantsByRole.get(r.id) ?? new Set<string>();
      const denies = deniesByRole.get(r.id) ?? new Set<string>();
      const roleSettings: Record<string, Setting> = {};
      for (let pid = 1; pid <= 18; pid++) {
        if (APP_LAYER_PERMISSION_IDS.has(pid)) {
          // No grant/deny row exists by design — the register's
          // neutral state.
          roleSettings[String(pid)] = "inherit";
          continue;
        }
        const key = permissionKeyForId(pid)!;
        if (pid === 18) {
          // 'locked' (non-owner) is stored as an explicit deny (00017).
          roleSettings[String(pid)] = grants.has(key) ? "allow" : "locked";
        } else if (denies.has(key)) {
          roleSettings[String(pid)] = "deny";
        } else if (grants.has(key)) {
          roleSettings[String(pid)] = "allow";
        } else {
          roleSettings[String(pid)] = "inherit";
        }
      }
      const pending = pendingByRole.get(r.id);
      return {
        id: roleUiId(r),
        regNumber: r.reg_number ?? `R-${String(idx + 1).padStart(2, "0")}`,
        name: r.name,
        type: r.is_system ? "System" : "Custom",
        summary: r.description ?? "",
        settings: roleSettings,
        pendingChanges: pending?.length
          ? pending.map(({ permissionId, from, to }) => ({
              permissionId,
              from,
              to,
            }))
          : undefined,
        pendingChangeIds: pending?.map((p) => p.changeId),
        lastChanged:
          r.updated_at === r.created_at ? "—" : fmtMonthDay(r.updated_at),
        createdOn: fmtMonthDay(r.created_at),
      };
    });

    /* ---- teams ---- */
    const membershipIdByUser = new Map(
      membershipRows.map((m) => [m.user_id, m.id] as const),
    );
    const teams: Team[] = teamRows.map((t, idx) => ({
      id: t.id,
      regNumber: t.reg_number ?? `T-${String(idx + 1).padStart(2, "0")}`,
      name: t.name,
      blurb: t.description ?? "",
      leadId: t.lead_membership_id,
      unlisted: t.is_unlisted || undefined,
    }));

    /* ---- members ---- */
    const teamsByMembership = new Map<
      string,
      { teamId: string; lead: boolean }[]
    >();
    for (const tm of teamMembersRes.data ?? []) {
      const team = teamRows.find((t) => t.id === tm.team_id);
      const list = teamsByMembership.get(tm.membership_id) ?? [];
      list.push({
        teamId: tm.team_id,
        lead: team?.lead_membership_id === tm.membership_id,
      });
      teamsByMembership.set(tm.membership_id, list);
    }
    const members: Member[] = membershipRows.map((m) => {
      const profile = profiles.get(m.user_id);
      const roleRow = roleRows.find((rr) => rr.id === m.role_id);
      return {
        id: m.id,
        name: profile?.full_name || nameFromEmail(profile?.email ?? ""),
        email: profile?.email ?? "",
        roleId: roleRow ? roleUiId(roleRow) : m.role_id,
        status: m.is_active ? "active" : "deactivated",
        teams: teamsByMembership.get(m.id) ?? [],
        joined: fmtMonthYear(m.joined_at),
        lastActive: fmtLastActive(m.last_active_at),
        title: profile?.title ?? undefined,
        deactivatedBy: m.deactivated_by
          ? profileName(m.deactivated_by)
          : undefined,
        deactivatedOn: m.deactivated_at
          ? fmtMonthDay(m.deactivated_at)
          : undefined,
      };
    });

    /* ---- invitations ('bounced' = pending + bounce note in message) ---- */
    const invitations: Invitation[] = (invRes.data ?? []).map((inv) => {
      const bounced =
        inv.status === "pending" &&
        (inv.message ?? "").toLowerCase().includes("bounced");
      const suggested = inv.message?.match(
        /suggested address:\s*(\S+@\S+)/i,
      )?.[1];
      const roleRow = roleRows.find((rr) => rr.id === inv.role_id);
      return {
        id: inv.id,
        name: nameFromEmail(inv.email),
        email: inv.email,
        suggestedEmail: suggested,
        roleId: roleRow ? roleUiId(roleRow) : inv.role_id,
        teamId: inv.team_ids[0] ?? "",
        invitedById: membershipIdByUser.get(inv.invited_by) ?? "",
        sent: fmtMonthDay(inv.created_at),
        status: bounced
          ? "bounced"
          : inv.status === "pending"
            ? "open"
            : (inv.status as Invitation["status"]),
        openedAt: null,
        expires: fmtMonthDay(inv.expires_at),
        acceptedOn: inv.accepted_at ? fmtMonthDay(inv.accepted_at) : undefined,
      };
    });

    /* ---- audit ---- */
    const auditEntries: AuditEntry[] = (auditRes.data ?? []).map((a) => {
      const meta = (a.metadata ?? {}) as Record<string, unknown>;
      /* Seeded rows may carry a fixture actorId in metadata ("system"
         or a roster number that no longer resolves); live rows resolve
         through the membership map; a null actor is the system. */
      const actorMemberId =
        meta.actorId === "system"
          ? "system"
          : (membershipIdByUser.get(a.actor_id) ??
            (a.actor_id ? a.actor_id : "system"));
      const actorName = profileName(a.actor_id);
      const summary =
        typeof meta.summary === "string" && meta.summary
          ? meta.summary
          : `${actorName} — ${a.action.replace(/[._]/g, " ")}${a.target_label ? `: ${a.target_label}` : ""}`;
      const entry: AuditEntry & Record<string, unknown> = {
        id:
          typeof meta.id === "string" && meta.id ? meta.id : a.id,
        day: fmtDayFull(a.created_at),
        time: fmtTime(a.created_at),
        actorId: actorMemberId,
        kind: auditKind(a.action),
        summary,
        detail: typeof meta.detail === "string" ? meta.detail : undefined,
        dateISO: a.created_at.slice(0, 10),
        category: auditKind(a.action),
        roleChange:
          a.action.includes("role") || a.action.includes("permission"),
      };
      return entry as AuditEntry;
    });

    /* ---- org (settings live on the organizations row — 00009/00018) ---- */
    const now = new Date();
    const org: Org = {
      name: orgRow.name,
      domain: orgRow.allowed_domains[0] ?? orgRow.slug,
      domainVerified: "",
      today: now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }),
      todayFull: now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
      plan: {
        // Plan name / seats / renew dates have no storage (Worker S
        // open question 2) — seats fall back to the live count so the
        // billing math is real; the price is config (seat_price_cents).
        name: "",
        seats:
          members.filter((m) => m.status === "active").length +
          invitations.filter((i) => i.status === "open" || i.status === "bounced").length,
        pricePerSeat: (orgRow.seat_price_cents ?? 800) / 100,
        renews: "",
        nextInvoice: "",
        billingContactId: "",
      },
      baseline: { allowedPermissionIds: [...BASELINE_PERMISSION_IDS] },
      groups: PERMISSION_GROUPS,
      permissions,
      roles,
    };

    /* ---- needs-owner (derived from real rows, never fixtures) ---- */
    const needsOwner: NeedsOwnerItem[] = [];
    for (const r of roles) {
      if (r.pendingChanges?.length) {
        needsOwner.push({
          id: `role-review-${r.id}`,
          severity: 1,
          title: `${r.name} review is ready`,
          detail: `${r.pendingChanges.length} change${r.pendingChanges.length === 1 ? "" : "s"} waiting for review.`,
          action: "Review changes",
          href: `/app/roles/${r.id}`,
        });
      }
    }
    for (const inv of invitations) {
      if (inv.status === "bounced") {
        needsOwner.push({
          id: `invite-bounced-${inv.id}`,
          severity: 2,
          title: `${inv.name}'s invite didn't arrive`,
          detail: inv.suggestedEmail
            ? `The invitation to ${inv.email} bounced. The address looks like a typo for ${inv.suggestedEmail}.`
            : `The invitation to ${inv.email} bounced.`,
          action: "Fix and resend",
          href: "/app/invitations",
        });
      }
    }
    const soon = invitations.filter((i) => {
      if (i.status !== "open") return false;
      const row = (invRes.data ?? []).find((x) => x.id === i.id);
      if (!row) return false;
      const ms = new Date(row.expires_at).getTime() - now.getTime();
      return ms > 0 && ms < 3 * 86400000;
    });
    for (const inv of soon.slice(0, 2)) {
      needsOwner.push({
        id: `invite-expiring-${inv.id}`,
        severity: 4,
        title: `${inv.name}'s invite expires ${inv.expires}`,
        detail: `${inv.name} was invited on ${inv.sent} and hasn't accepted yet.`,
        action: "Resend",
        href: "/app/invitations",
      });
    }

    return { org, members, teams, invitations, auditEntries, needsOwner };
  },
);

/** Resolve a UI role id (system_key or uuid) to the DB role uuid. */
export async function resolveRoleUuid(
  orgId: string,
  uiRoleId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("roles")
    .select("id, system_key")
    .eq("org_id", orgId);
  const row = (data ?? []).find(
    (r) => r.system_key === uiRoleId || r.id === uiRoleId,
  );
  return row?.id ?? null;
}
