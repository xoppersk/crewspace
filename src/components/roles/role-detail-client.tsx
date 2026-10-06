"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Users } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { updateRoleMeta, updateRolePermissions } from "@/lib/roles/actions";
import { DeleteRoleButton } from "./delete-role-button";
import { PermissionMatrix } from "./permission-matrix";
import type { ResourceGroup } from "@/lib/roles/catalog";
import { RoleBadge } from "./role-badge";

/**
 * Role detail screen (client shell). The server page loads the role,
 * catalog, keys, and members; this component owns the interactive matrix,
 * the name/description editor, and the danger zone.
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
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <RoleBadge roleName={role.name} systemKey={role.systemKey} />
            {role.isSystem ? (
              <Badge variant="secondary">System</Badge>
            ) : (
              <Badge variant="outline">Custom</Badge>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <Users className="size-3.5" aria-hidden />
              Used by {affectedMemberCount} member{affectedMemberCount === 1 ? "" : "s"}
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{role.name}</h1>
          {role.description ? (
            <p className="max-w-2xl text-sm text-muted-foreground">{role.description}</p>
          ) : null}
        </div>
        {canEdit ? <EditRoleMetaDialog role={role} /> : null}
      </div>

      {/* Permission matrix */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Permissions</CardTitle>
        </CardHeader>
        <CardContent>
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
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Members with this role
            <span className="ml-2 font-normal text-muted-foreground">{members.length}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members hold this role yet.
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
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-destructive">Danger zone</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted-foreground">
              Deleting “{role.name}” is permanent. It’s blocked while any member holds the role —
              reassign them first.
            </p>
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
