"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import { transferOwnership } from "@/lib/members/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TypeToConfirmDialog } from "@/components/directory/type-to-confirm-dialog";

export interface TransferCandidate {
  membershipId: string;
  fullName: string;
  roleName: string;
}

/**
 * OwnershipTransferCard — Settings → General → Ownership (owners only).
 * ============================================================================
 * Picks the next owner from the other active members, spells out the
 * consequences, then requires typing the organization name to confirm
 * (reusing the shared TypeToConfirmDialog). The server action +
 * transfer_org_ownership() do the atomic swap; this card only collects the
 * target and surfaces plain-language errors.
 */
export function OwnershipTransferCard({
  orgId,
  orgSlug,
  orgName,
  candidates,
}: {
  orgId: string;
  orgSlug: string;
  orgName: string;
  candidates: TransferCandidate[];
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [done, setDone] = useState(false);

  const selected = candidates.find((c) => c.membershipId === selectedId) ?? null;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base text-destructive">
          <AlertTriangle className="size-4" />
          Transfer ownership
        </CardTitle>
        <CardDescription>
          Make another member the owner of {orgName}. Only the owner can do this.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {done ? (
          <p className="text-sm text-emerald-600" role="status">
            Ownership transferred. You are now an admin — the new owner can transfer it
            back if needed.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ownership-new-owner">New owner</Label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="ownership-new-owner">
                  <SelectValue placeholder="Choose a member…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.membershipId} value={c.membershipId}>
                      {c.fullName} · {c.roleName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <p className="font-semibold">Before you continue, know what happens:</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted-foreground">
                <li>
                  {selected ? (
                    <>
                      <span className="font-medium text-foreground">{selected.fullName}</span>{" "}
                      becomes the owner with full control of the organization.
                    </>
                  ) : (
                    "The member you pick becomes the owner with full control of the organization."
                  )}
                </li>
                <li>
                  You are demoted to <span className="font-medium text-foreground">Admin</span> —
                  you keep managing members, teams, and settings, but you can no longer
                  transfer ownership or delete the organization.
                </li>
                <li>
                  The transfer is written to the audit log and can&apos;t be undone by you —
                  only the new owner can transfer it back.
                </li>
              </ul>
            </div>

            <div>
              <Button
                variant="destructive"
                disabled={!selected}
                onClick={() => setConfirmOpen(true)}
              >
                Transfer ownership…
              </Button>
            </div>
          </>
        )}

        <TypeToConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={`Transfer ownership to ${selected?.fullName ?? "…"}`}
          description={
            <>
              <span className="font-medium text-foreground">{selected?.fullName}</span> will
              become the owner of <span className="font-medium text-foreground">{orgName}</span>,
              and you will be demoted to Admin. This is recorded in the audit log.
            </>
          }
          expected={orgName}
          confirmLabel="Transfer ownership"
          onConfirm={async () => {
            const result = await transferOwnership(orgId, orgSlug, selectedId);
            if (result.ok) {
              setDone(true);
              router.refresh();
            }
            return result;
          }}
        />
      </CardContent>
    </Card>
  );
}
