"use client";

import { Check, HelpCircle } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RoleBadge } from "./role-badge";

/**
 * MyAccessPanel — the "My access" view (APP-FLOW §3, profile page).
 * Owned by Worker 3; Worker 5 mounts it on the profile page.
 * Props: { permissions: string[]; roleName: string }.
 *
 * Renders the role card + the effective permission union grouped by
 * resource, with plain-language labels from the permissions catalog.
 * The catalog is static here (the DB table is append-never, seeded once
 * from migration 00002) so this component works in any render context.
 */

interface CatalogEntry {
  key: string;
  label: string;
  description: string;
}

const RESOURCE_GROUPS: { resource: string; label: string; entries: CatalogEntry[] }[] = [
  {
    resource: "org",
    label: "Organization",
    entries: [
      { key: "org:read", label: "View organization", description: "View the organization and its data" },
      { key: "org:update", label: "Edit organization", description: "Edit org name, slug, and logo" },
      { key: "org:transfer_ownership", label: "Transfer ownership", description: "Transfer org ownership to another member" },
    ],
  },
  {
    resource: "members",
    label: "Members",
    entries: [
      { key: "members:read", label: "View members", description: "View the member directory and profiles" },
      { key: "members:invite", label: "Invite members", description: "Invite new members (scoped by invite policy)" },
      { key: "members:change_role", label: "Change roles", description: "Change another member's role" },
      { key: "members:deactivate", label: "Deactivate members", description: "Deactivate, reactivate, and remove members" },
    ],
  },
  {
    resource: "teams",
    label: "Teams",
    entries: [
      { key: "teams:create", label: "Create teams", description: "Create new teams" },
      { key: "teams:manage", label: "Manage teams", description: "Rename/archive teams, manage members and lead" },
    ],
  },
  {
    resource: "roles",
    label: "Roles",
    entries: [
      { key: "roles:create", label: "Create roles", description: "Create custom roles" },
      { key: "roles:assign", label: "Assign roles", description: "Assign roles to members" },
      { key: "roles:update", label: "Edit roles", description: "Edit a custom role's name, description, or permissions" },
      { key: "roles:delete", label: "Delete roles", description: "Delete a custom role (only when unused)" },
    ],
  },
  {
    resource: "invitations",
    label: "Invitations",
    entries: [
      { key: "invitations:manage", label: "Manage invitations", description: "Resend and revoke invitations" },
    ],
  },
  {
    resource: "audit",
    label: "Audit log",
    entries: [
      { key: "audit:read", label: "View audit log", description: "View the audit log" },
      { key: "audit:export", label: "Export audit log", description: "Export the audit log to CSV (itself audited)" },
    ],
  },
  {
    resource: "settings",
    label: "Settings",
    entries: [
      { key: "settings:manage", label: "Manage settings", description: "Change org settings and member policy" },
    ],
  },
  {
    resource: "billing",
    label: "Billing",
    entries: [
      { key: "billing:view", label: "View billing", description: "View plan/limits info (informational in v1)" },
    ],
  },
];

/** "Why can't I do X?" — missing capabilities mapped to who grants them. */
const WHY_EXPLAINERS: { key: string; action: string; answer: string }[] = [
  {
    key: "members:invite",
    action: "invite members",
    answer: "Owners, admins, and managers can invite in this workspace. Ask one of them to send the invitation.",
  },
  {
    key: "members:change_role",
    action: "change someone's role",
    answer: "Only owners and admins can change roles. Your current role doesn't include that capability.",
  },
  {
    key: "audit:read",
    action: "see the audit log",
    answer: "The audit log is visible to owners and admins — ask an owner for access.",
  },
  {
    key: "teams:create",
    action: "create teams",
    answer: "Owners, admins, and managers can create teams. Ask one of them to set the team up.",
  },
];

export function MyAccessPanel({
  permissions,
  roleName,
  roleGrant,
}: {
  permissions: string[];
  roleName: string;
  /** "Granted by <name> on <date>" attribution (UI-DESIGN.md §2.17). */
  roleGrant: { by: string; at: string } | null;
}) {
  const granted = new Set(permissions);
  const total = RESOURCE_GROUPS.reduce((n, g) => n + g.entries.length, 0);
  const grantedCount = permissions.filter((key) => granted.has(key)).length;

  // "Why can't I do X?" — missing capabilities mapped to who grants them,
  // in plain language (transparency without a support ticket).
  const explainers = WHY_EXPLAINERS.filter((e) => !granted.has(e.key));

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your role</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge roleName={roleName} className="text-xs" />
            <p className="text-sm text-muted-foreground">
              {grantedCount} of {total} permissions granted
            </p>
          </div>
          {roleGrant ? (
            <p className="text-xs text-muted-foreground">
              Granted by {roleGrant.by} on{" "}
              {new Date(roleGrant.at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {explainers.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="size-4 text-muted-foreground" aria-hidden />
              Why can&rsquo;t I do that?
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {explainers.map((explainer) => (
              <div key={explainer.key} className="text-sm">
                <p className="font-medium">“Why can&rsquo;t I {explainer.action}?”</p>
                <p className="text-muted-foreground">{explainer.answer}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {RESOURCE_GROUPS.map((group) => {
          const visible = group.entries.filter((entry) => granted.has(entry.key));
          if (visible.length === 0) return null;
          return (
            <Card key={group.resource}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  {group.label}
                  <span className="ml-2 font-normal text-muted-foreground">
                    {visible.length} of {group.entries.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2.5 pt-0">
                {visible.map((entry) => (
                  <div key={entry.key} className="flex items-start gap-2.5">
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-success-soft">
                      <Check className="size-3 text-success" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{entry.label}</p>
                      <p className="text-xs text-muted-foreground">{entry.description}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
