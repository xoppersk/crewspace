import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getOrg,
  getPermissions,
  getRole,
  roleMembers,
} from "@/lib/api";
import { AppShell } from "@/components/Shell";
import { DeniedState } from "@/components/States";
import { RoleDetailClient } from "./RoleDetailClient";

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { state } = await searchParams;
  if (state === "denied") {
    return { title: "Crewspace — Permission denied" };
  }
  const role = getRole(id);
  return {
    title: role ? `Crewspace — ${role.name} role` : "Crewspace — Roles",
  };
}

export default async function RoleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string }>;
}) {
  const { id } = await params;
  const { state } = await searchParams;
  const role = getRole(id);
  if (!role) notFound();

  /* X-01: a Support lead (Rita Alvarez, 027) opens the edit page.
     DeniedState is persona-bound: it always renders the Support-lead
     scenario, whichever role route the toggle is attached to. */
  if (state === "denied") {
    return (
      <AppShell current="roles" personId="027">
        <DeniedState />
      </AppShell>
    );
  }

  const org = getOrg();
  const members = roleMembers(id);
  const history =
    id === "product-admin"
      ? [
          { when: "Oct 5", text: "Maya Jordan assigned by Sheku Koroma" },
          { when: "Oct 2", text: "Create teams: Inherit → Allow" },
          { when: "Sep 18", text: "Role created from Member" },
        ]
      : [{ when: "—", text: `Last changed ${role.lastChanged}` }];

  return (
    <AppShell current="roles">
      <div className="crumb">
        <Link href="/app/roles">Roles</Link> / {role.name}
      </div>
      <div className="cols">
        <RoleDetailClient
          role={role}
          permissions={getPermissions()}
          groups={org.groups}
          members={members}
          history={history}
        />
      </div>
    </AppShell>
  );
}
