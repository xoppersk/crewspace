"use server";

import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { requireOrgAccess } from "@/lib/permissions";

export interface PaletteIndex {
  members: { id: string; name: string }[];
  teams: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

const EMPTY: PaletteIndex = { members: [], teams: [], roles: [] };
const LIMIT = 200;

/**
 * Search index for the ⌘K palette: members, teams, and roles the viewer may
 * see. Layer 2: org:read minimum; member names additionally need
 * members:read (the RLS policy on memberships agrees).
 */
export async function getPaletteIndex(orgSlug: string): Promise<PaletteIndex> {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (!org) notFound();

  let permissions: string[];
  try {
    ({ permissions } = await requireOrgAccess(org.id, "org:read"));
  } catch {
    return EMPTY;
  }

  const index: PaletteIndex = { members: [], teams: [], roles: [] };

  if (permissions.includes("members:read")) {
    const { data: memberships } = await supabase
      .from("memberships")
      .select("id, user_id")
      .eq("org_id", org.id)
      .eq("is_active", true)
      .limit(LIMIT);
    const userIds = (memberships ?? []).map((m) => m.user_id);
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));
      index.members = (memberships ?? []).map((m) => ({
        id: m.id,
        name: nameById.get(m.user_id) ?? "Unknown member",
      }));
      index.members.sort((a, b) => a.name.localeCompare(b.name));
    }
  }

  const [{ data: teams }, { data: roles }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name")
      .eq("org_id", org.id)
      .eq("is_archived", false)
      .order("name")
      .limit(LIMIT),
    supabase.from("roles").select("id, name").eq("org_id", org.id).order("name").limit(100),
  ]);
  index.teams = (teams ?? []).map((t) => ({ id: t.id, name: t.name }));
  index.roles = (roles ?? []).map((r) => ({ id: r.id, name: r.name }));

  return index;
}
