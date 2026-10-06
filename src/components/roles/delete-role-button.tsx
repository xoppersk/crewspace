"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { deleteRole } from "@/lib/roles/actions";
import { useOrg } from "@/app/(app)/[orgSlug]/org-context";

/**
 * Delete affordance for custom roles. The server action re-checks the
 * "no members hold it" rule; when blocked, the member names come back and
 * are listed so the admin knows exactly who to reassign.
 */
export function DeleteRoleButton({
  roleId,
  roleName,
  variant = "ghost",
}: {
  roleId: string;
  roleName: string;
  variant?: "ghost" | "outline";
}) {
  const org = useOrg();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockedMembers, setBlockedMembers] = useState<string[]>([]);

  async function onDelete() {
    setDeleting(true);
    setError(null);
    setBlockedMembers([]);
    const result = await deleteRole(org.id, org.slug, roleId);
    setDeleting(false);
    if (result.ok) {
      setOpen(false);
      router.refresh();
    } else {
      setError(result.error);
      setBlockedMembers(result.memberNames ?? []);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant={variant} size="sm" className="text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
          <span className="sr-only sm:not-sr-only">Delete</span>
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{roleName}”?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently removes the role and its permission set. Members holding it must be
            reassigned first — the delete is blocked until then.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="font-medium text-destructive">{error}</p>
            {blockedMembers.length > 0 ? (
              <ul className="mt-2 list-disc pl-5 text-muted-foreground">
                {blockedMembers.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void onDelete();
            }}
            disabled={deleting}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete role"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
