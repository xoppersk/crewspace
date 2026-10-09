"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useOrg } from "@/app/(app)/[orgSlug]/org-context";
import { createRole } from "@/lib/roles/actions";
import { PermissionMatrix } from "./permission-matrix";
import type { ResourceGroup } from "@/lib/roles/catalog";
import { RoleBadge } from "./role-badge";

/**
 * New-role wizard: Step 1 name + description + "start from" (blank or clone
 * a system role) → Step 2 permission matrix → Step 3 review (grouped
 * permission summary + optional assign-to-members picker) → Create → lands
 * on the role detail with a success toast.
 */

export interface WizardSystemRole {
  id: string;
  name: string;
  description: string | null;
  systemKey: string | null;
  keys: string[];
}

export interface WizardMember {
  membershipId: string;
  name: string;
}

const STEPS = ["Details", "Permissions", "Review"] as const;

export function RoleWizard({
  systemRoles,
  catalog,
  members,
  canAssign,
  cloneFromId,
}: {
  systemRoles: WizardSystemRole[];
  catalog: ResourceGroup[];
  members: WizardMember[];
  canAssign: boolean;
  /** Pre-select "clone" from a system role (the detail page's clone path). */
  cloneFromId?: string;
}) {
  const org = useOrg();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startFrom, setStartFrom] = useState<string>(cloneFromId ?? "blank");
  const [keys, setKeys] = useState<string[]>(
    () => systemRoles.find((r) => r.id === cloneFromId)?.keys ?? [],
  );
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameValid = name.trim().length >= 2;

  function pickStartFrom(value: string) {
    setStartFrom(value);
    const source = systemRoles.find((r) => r.id === value);
    setKeys(source ? source.keys : []);
  }

  const groupedSummary = useMemo(
    () =>
      catalog
        .map((group) => ({
          label: group.label,
          entries: group.permissions.filter((p) => keys.includes(p.key)),
        }))
        .filter((group) => group.entries.length > 0),
    [catalog, keys],
  );

  function toggleAssign(membershipId: string) {
    setAssignIds((prev) =>
      prev.includes(membershipId)
        ? prev.filter((id) => id !== membershipId)
        : [...prev, membershipId],
    );
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    const result = await createRole(org.id, org.slug, {
      name: name.trim(),
      description: description.trim(),
      permissionKeys: keys,
      assignMembershipIds: assignIds,
    });
    setCreating(false);
    if (result.ok) {
      router.push(`/${org.slug}/roles/${result.roleId}?created=1`);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">New role</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a custom role — a named subset of permissions you can assign to members.
        </p>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-2" aria-label="Progress">
        {STEPS.map((label, index) => {
          const done = index < step;
          const current = index === step;
          return (
            <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
              <span
                aria-current={current ? "step" : undefined}
                className={
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                  (done
                    ? "bg-success text-white"
                    : current
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground")
                }
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={
                  "hidden text-sm sm:block " +
                  (current ? "font-medium" : "text-muted-foreground")
                }
              >
                {label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className="mx-1 h-px flex-1 bg-border" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {step === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Role details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-name">Name</Label>
              <Input
                id="wizard-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Support Lead"
                maxLength={60}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="wizard-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="wizard-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this role for?"
                maxLength={280}
                rows={3}
              />
            </div>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">Start from</legend>
              <RadioGroup value={startFrom} onValueChange={pickStartFrom} className="flex flex-col gap-2">
                <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-checked:border-primary">
                  <RadioGroupItem value="blank" id="start-blank" />
                  <span className="text-sm">
                    <span className="font-medium">Blank role</span>
                    <span className="block text-xs text-muted-foreground">
                      No permissions — pick each one in the next step.
                    </span>
                  </span>
                </label>
                {systemRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md border px-3 py-2 has-checked:border-primary"
                  >
                    <RadioGroupItem value={role.id} id={`start-${role.id}`} />
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <RoleBadge roleName={role.name} systemKey={role.systemKey} />
                      <span className="truncate text-xs text-muted-foreground">
                        {role.keys.length} permissions
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          </CardContent>
        </Card>
      ) : null}

      {step === 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <PermissionMatrix
              catalog={catalog}
              initialKeys={[]}
              value={keys}
              onValueChange={setKeys}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              {keys.length} of {catalog.reduce((n, g) => n + g.permissions.length, 0)} permissions
              selected.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div>
                <p className="text-sm font-semibold">{name.trim()}</p>
                {description.trim() ? (
                  <p className="text-sm text-muted-foreground">{description.trim()}</p>
                ) : null}
              </div>
              {groupedSummary.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No permissions selected — this role grants nothing. Go back to add some.
                </p>
              ) : (
                <div className="flex flex-col gap-3">
                  {groupedSummary.map((group) => (
                    <div key={group.label}>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {group.label}
                      </p>
                      <ul className="mt-1 flex flex-col gap-1">
                        {group.entries.map((entry) => (
                          <li key={entry.key} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
                            <span>
                              <span className="font-medium">{entry.label}</span>
                              {entry.description ? (
                                <span className="text-muted-foreground"> — {entry.description}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {canAssign ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Assign to members <span className="font-normal text-muted-foreground">(optional)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No other active members to assign.</p>
                ) : (
                  <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {members.map((member) => (
                      <li key={member.membershipId}>
                        <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                          <Checkbox
                            checked={assignIds.includes(member.membershipId)}
                            onCheckedChange={() => toggleAssign(member.membershipId)}
                            aria-label={`Assign to ${member.name}`}
                          />
                          <span className="text-sm">{member.name}</span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Sticky footer actions */}
      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t bg-background/95 py-4 backdrop-blur">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} disabled={creating}>
              <ArrowLeft className="size-4" /> Back
            </Button>
          ) : (
            <Button variant="ghost" asChild>
              <Link href={`/${org.slug}/roles`}>Cancel</Link>
            </Button>
          )}
        </div>
        {step < 2 ? (
          <Button onClick={() => setStep(step + 1)} disabled={step === 0 && !nameValid}>
            Continue <ArrowRight className="size-4" />
          </Button>
        ) : (
          <Button onClick={() => void handleCreate()} disabled={creating || !nameValid}>
            {creating ? "Creating…" : `Create role${assignIds.length > 0 ? ` & assign ${assignIds.length}` : ""}`}
          </Button>
        )}
      </div>
    </div>
  );
}
