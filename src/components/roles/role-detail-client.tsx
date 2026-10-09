"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, History, Pencil } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/app/(app)/[orgSlug]/org-context";
import { HintBar } from "@/components/crew/hint-bar";
import { RoleSeal } from "@/components/crew/role-seal";
import { updateRoleMeta, updateRolePermissions } from "@/lib/roles/actions";
import { DeleteRoleButton } from "./delete-role-button";
import { PermissionMatrix } from "./permission-matrix";
import type { ResourceGroup } from "@/lib/roles/catalog";
import { RoleBadge } from "./role-badge";

/**
 * Role detail screen — the Signature UI: the permission register.
 *
 * Topline: role name + seal (org · member count), top-actions (Duplicate,
 * Role history), hint bar stating the register's rule, then the permission
 * register card ("N shown · 18 total") with grouped rule sections and the
 * dark review bar. Members with this role + danger zone follow.
 */

export interface RoleMember {
  membershipId: string;
  userId: string;
  name: string;
  title: string | null;
}

export interface RoleDetailData {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  systemKey: string | null;
}

export function RoleDetailClient({
  role,
  catalog,
  initialKeys,
  affectedMemberCount,
  members,
  canEdit,
  canDelete,
}: {
  role: RoleDetailData;
  catalog: ResourceGroup[];
  initialKeys: string[];
  affectedMemberCount: number;
  members: RoleMember[];
  canEdit: boolean;
  canDelete: boolean;
}) {
  const org = useOrg();
  const router = useRouter();

  const totalPermissions = catalog.reduce((n, g) => n + g.permissions.length, 0);

  async function handleConfirm(nextKeys: string[]) {
    const result = await updateRolePermissions(org.id, org.slug, role.id, nextKeys);
    if (result.ok) router.refresh();
    return result.ok
      ? { ok: true as const }
      : { ok: false as const, error: result.error };
  }

  function handleCloneRequest() {
    router.push(`/${org.slug}/roles/new?clone=${role.id}`);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <li>
            <Link href={`/${org.slug}/roles`} className="hover:text-foreground hover:underline">
              Roles
            </Link>
          </li>
          <li aria-hidden className="text-muted-foreground/60">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            {role.name}
          </li>
        </ol>
      </nav>

      {/* Topline */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge roleName={role.name} systemKey={role.systemKey} />
            {role.isSystem ? (
              <Badge variant="secondary" className="uppercase tracking-wide">System</Badge>
            ) : (
              <Badge variant="outline" className="uppercase tracking-wide">Custom</Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{role.name}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <RoleSeal>{org.name}</RoleSeal>
            <span>
              {affectedMemberCount} member{affectedMemberCount === 1 ? "" : "s"}
            </span>
          </p>
          {role.description ? (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{role.description}</p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {canEdit ? <EditRoleMetaDialog role={role} /> : null}
          <Button variant="outline" size="sm" onClick={handleCloneRequest}>
            <Copy className="size-4" /> Duplicate
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/${org.slug}/audit?target=${role.id}`}>
              <History className="size-4" /> Role history
            </Link>
          </Button>
        </div>
      </div>

      {/* Hint bar */}
      <HintBar>
        {role.isSystem || !canEdit
          ? "Each permission states its effect in plain language. System roles are read-only — duplicate this role to customize it."
          : "Each permission states its effect in plain language. Toggle a permission to grant it — the review bar shows exactly who is affected before anything changes."}
      </HintBar>

      {/* Permission register */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Permission register</h2>
            <span className="text-xs text-muted-foreground">
              {totalPermissions} shown · {totalPermissions} total
            </span>
          </div>
          <PermissionMatrix
            catalog={catalog}
            initialKeys={initialKeys}
            readOnly={role.isSystem || !canEdit}
            affectedMemberCount={affectedMemberCount}
            onConfirm={canEdit && !role.isSystem ? handleConfirm : undefined}
            onCloneRequest={role.isSystem ? handleCloneRequest : undefined}
          />
        </CardContent>
      </Card>

      {/* Members with this role */}
      <Card>
        <CardContent className="pt-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Members with this role</h2>
            <span className="text-xs text-muted-foreground">
              {members.length} member{members.length === 1 ? "" : "s"}
            </span>
          </div>
          {members.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No members hold this role yet — assign it from the directory.
            </p>
          ) : (
            <ul className="divide-y">
              {members.map((member) => (
                <li key={member.membershipId}>
                  <Link
                    href={`/${org.slug}/directory/${member.userId}`}
                    className="flex items-center gap-3 py-2.5"
                  >
                    <Avatar className="size-8">
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((part) => part[0])
                          .slice(0, 2)
                          .join("")
                          .toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{member.name}</span>
                      {member.title ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {member.title}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Danger zone */}
      {canDelete ? (
        <Card className="border-destructive/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-6">
            <div>
              <h2 className="text-base font-semibold text-destructive">Danger zone</h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Deleting “{role.name}” is permanent. It’s blocked while any member holds the role —
                reassign them first.
              </p>
            </div>
            <DeleteRoleButton roleId={role.id} roleName={role.name} variant="outline" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function EditRoleMetaDialog({ role }: { role: RoleDetailData }) {
  const org = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    setSaving(true);
    setError(null);
    const result = await updateRoleMeta(org.id, org.slug, role.id, {
      name: name.trim(),
      description: description.trim(),
    });
    setSaving(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Edit details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit role</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role-description">Description</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void onSave()} disabled={saving || name.trim().length < 2}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
