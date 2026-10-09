import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import { RoleBadge } from "@/components/roles/role-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MemberAvatar } from "@/components/directory/member-avatar";

import { WhosOnlineStrip } from "./whos-online";

/**
 * MemberDashboard — the non-admin dashboard view: welcome header, "My
 * access" summary card (role + effective permissions grouped by resource),
 * "Who's online" strip (realtime), and the viewer's teams.
 */
export async function MemberDashboard({
  orgSlug,
  orgName,
  userId,
  membershipId,
  permissions,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  userId: string;
  membershipId: string;
  permissions: string[];
}) {
  const supabase = await createClient();

  const [{ data: profile }, { data: membershipRow }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase
      .from("memberships")
      .select("role_id, roles!inner(id, name, system_key, description)")
      .eq("id", membershipId)
      .maybeSingle(),
  ]);

  const role = membershipRow?.roles as unknown as {
    id: string;
    name: string;
    system_key: string | null;
    description: string | null;
  } | null;

  const { data: effectiveRows } = role
    ? await supabase
        .from("role_permissions")
        .select("permissions!inner(key, resource, label, description)")
        .eq("role_id", role.id)
    : { data: [] as { permissions: unknown }[] };

  const grouped = new Map<string, { label: string; description: string | null }[]>();
  for (const row of effectiveRows ?? []) {
    const p = row.permissions as unknown as {
      resource: string;
      label: string;
      description: string | null;
    };
    const list = grouped.get(p.resource) ?? [];
    list.push({ label: p.label, description: p.description });
    grouped.set(p.resource, list);
  }

  // Viewer's teams with member counts.
  const { data: myTeamsRows } = await supabase
    .from("team_memberships")
    .select("team_id, teams!inner(id, name, description)")
    .eq("membership_id", membershipId);

  const myTeams = (myTeamsRows ?? []).map((r) => {
    const t = r.teams as unknown as { id: string; name: string; description: string | null };
    return { id: t.id, name: t.name, description: t.description };
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back, {firstName}</h1>
        <p className="text-sm text-muted-foreground">
          {orgName} — here&rsquo;s your access and your teams.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* My access */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">My access</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Role</span>
              {role ? (
                <RoleBadge roleName={role.name} systemKey={role.system_key} />
              ) : (
                <span className="text-sm">—</span>
              )}
            </div>
            {role?.description ? (
              <p className="text-sm text-muted-foreground">{role.description}</p>
            ) : null}
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm text-muted-foreground">Permissions</span>
              <span className="text-sm font-medium tabular-nums">
                {permissions.length} granted
              </span>
            </div>
            {grouped.size > 0 ? (
              <div className="flex flex-col gap-2">
                {[...grouped.entries()].map(([resource, perms]) => (
                  <div key={resource}>
                    <p className="text-xs font-semibold tracking-wide uppercase">{resource}</p>
                    <ul className="mt-1 flex flex-col gap-0.5">
                      {perms.map((p) => (
                        <li key={p.label} className="text-sm text-muted-foreground" title={p.description ?? undefined}>
                          {p.label}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Who's online */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who&rsquo;s online</CardTitle>
          </CardHeader>
          <CardContent>
            <WhosOnlineStrip />
          </CardContent>
        </Card>
      </div>

      {/* My teams */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold tracking-tight">My teams</h2>
        {myTeams.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You&rsquo;re not on any teams yet — ask an admin to add you.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {myTeams.map((team) => (
              <Link
                key={team.id}
                href={`/${orgSlug}/teams/${team.id}`}
                className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardContent className="flex items-center gap-3 p-4">
                    <MemberAvatar
                      name={team.name}
                      avatarUrl={null}
                      userId={team.id}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{team.name}</span>
                      {team.description ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {team.description}
                        </span>
                      ) : null}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
