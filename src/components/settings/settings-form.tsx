"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, Loader2, X } from "lucide-react";

import {
  INVITE_POLICY_OPTIONS,
  SESSION_TIMEOUT_OPTIONS,
  domainSchema,
} from "@/lib/validations/settings";
import { saveOrgSettings } from "@/app/(app)/[orgSlug]/settings/actions";
import { ImageUpload } from "@/components/app/image-upload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TransferCandidate } from "./ownership-transfer-card";
import { cn } from "@/lib/utils";

/**
 * Lazy: the ownership card (member picker + type-to-confirm dialog) only
 * renders for owners, below the fold — code-split it so the settings
 * bundle stays lean.
 */
const OwnershipTransferCard = dynamic(
  () =>
    import("./ownership-transfer-card").then((m) => ({
      default: m.OwnershipTransferCard,
    })),
);

export interface SettingsInitial {
  name: string;
  slug: string;
  logo_url: string | null;
  default_role_id: string;
  invite_policy: "owners" | "admins" | "managers";
  allowed_domains: string[];
  require_email_verification: boolean;
  /** String form for the select: minutes, or "never". */
  session_timeout_minutes: string;
  require_reauth_destructive: boolean;
}

export interface SettingsUsage {
  members: number;
  membersLimit: number;
  teams: number;
  teamsLimit: number;
  customRoles: number;
  customRolesLimit: number;
  auditRetentionMonths: number;
}

/** Ownership-transfer section data (server-computed; card renders for owners only). */
export interface SettingsOwnership {
  canTransfer: boolean;
  orgName: string;
  candidates: TransferCandidate[];
}

function Field({
  label,
  htmlFor,
  description,
  children,
}: {
  label: string;
  htmlFor: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
    </div>
  );
}

/** Chip input for allowed email domains (Enter or comma adds a chip). */
function DomainChips({
  value,
  onChange,
}: {
  value: string[];
  onChange: (domains: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  function commit(raw: string) {
    const candidate = raw.trim().toLowerCase().replace(/,+$/, "");
    if (!candidate) {
      setDraft("");
      return;
    }
    const parsed = domainSchema.safeParse(candidate);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid domain like example.com.");
      return;
    }
    if (value.includes(parsed.data)) {
      setError("That domain is already in the list.");
      return;
    }
    setError(null);
    setDraft("");
    onChange([...value, parsed.data]);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50">
        {value.map((domain) => (
          <span
            key={domain}
            className="flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
          >
            {domain}
            <button
              type="button"
              aria-label={`Remove ${domain}`}
              onClick={() => onChange(value.filter((d) => d !== domain))}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
            } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (draft.trim()) commit(draft);
          }}
          placeholder={value.length === 0 ? "example.com" : ""}
          aria-label="Add an allowed email domain"
          className="min-w-32 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function UsageBar({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint?: string;
}) {
  const percent = Math.min(100, Math.round((used / limit) * 100));
  const over = used > limit;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground tabular-nums">
          {used} of {limit} used
          {over ? <span className="ml-1 font-semibold text-destructive">· over limit</span> : null}
        </span>
      </div>
      <Progress value={percent} aria-label={`${label}: ${used} of ${limit} used`} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/**
 * Settings form — tabs General | Member policy | Security | Plan, with a
 * sticky dirty-state save bar ("You have unsaved changes — Save / Discard").
 */
export function SettingsForm({
  orgId,
  orgSlug,
  initial,
  roleOptions,
  usage,
  ownership,
}: {
  orgId: string;
  orgSlug: string;
  initial: SettingsInitial;
  roleOptions: { id: string; name: string; isSystem: boolean }[];
  usage: SettingsUsage;
  ownership: SettingsOwnership;
}) {
  const router = useRouter();
  const [form, setForm] = useState<SettingsInitial>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(initial),
    [form, initial],
  );

  function set<K extends keyof SettingsInitial>(key: K, value: SettingsInitial[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (error) setError(null);
  }

  function discard() {
    setForm(initial);
    setError(null);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveOrgSettings(orgSlug, {
        name: form.name,
        slug: form.slug,
        logo_url: form.logo_url ?? "",
        default_role_id: form.default_role_id,
        invite_policy: form.invite_policy,
        allowed_domains: form.allowed_domains,
        require_email_verification: form.require_email_verification,
        session_timeout_minutes:
          form.session_timeout_minutes === "never"
            ? null
            : Number(form.session_timeout_minutes),
        require_reauth_destructive: form.require_reauth_destructive,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      if (result.slugChanged) {
        router.push(`/${result.newSlug}/settings`);
        router.refresh();
      }
    } catch {
      setError("Couldn't save settings — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  const slugRenamed = form.slug !== initial.slug;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization settings</h1>
        <p className="text-muted-foreground">
          Identity, member policy, security, and your plan.
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="policy">Member policy</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">General</CardTitle>
              <CardDescription>How your organization appears across Crewspace.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>Logo</Label>
                <ImageUpload
                  bucket="org-logos"
                  path={`${orgId}/logo.png`}
                  currentUrl={form.logo_url}
                  fallbackLabel={form.name}
                  shape="square"
                  onUploaded={(url) => set("logo_url", url)}
                />
              </div>
              <Field
                label="Organization name"
                htmlFor="settings-name"
                description="Shown in the sidebar, invitations, and emails."
              >
                <Input
                  id="settings-name"
                  value={form.name}
                  maxLength={80}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field
                label="Workspace slug"
                htmlFor="settings-slug"
                description={`Your workspace lives at /${form.slug || "…"}.`}
              >
                <Input
                  id="settings-slug"
                  value={form.slug}
                  maxLength={48}
                  onChange={(e) => set("slug", e.target.value.toLowerCase())}
                  className="font-mono"
                />
              </Field>
              {slugRenamed ? (
                <div
                  role="alert"
                  className="flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                >
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <p>
                    <span className="font-semibold">Renaming changes your workspace URL.</span>{" "}
                    Links to /{initial.slug} — bookmarks, invitation emails, shared pages — will
                    stop working. Members will be redirected to /{form.slug} automatically.
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          {ownership.canTransfer ? (
            <OwnershipTransferCard
              orgId={orgId}
              orgSlug={orgSlug}
              orgName={ownership.orgName}
              candidates={ownership.candidates}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="policy">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Member policy</CardTitle>
              <CardDescription>Defaults and rules for everyone who joins.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field
                label="Default role for new members"
                htmlFor="settings-default-role"
                description="Members joining through an invitation without a specific role get this."
              >
                <Select
                  value={form.default_role_id}
                  onValueChange={(value) => set("default_role_id", value)}
                >
                  <SelectTrigger id="settings-default-role">
                    <SelectValue placeholder="Choose a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roleOptions.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                        {role.isSystem ? (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            System
                          </Badge>
                        ) : null}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex flex-col gap-1.5">
                <Label>Who can invite new members</Label>
                <RadioGroup
                  value={form.invite_policy}
                  onValueChange={(value) =>
                    set("invite_policy", value as SettingsInitial["invite_policy"])
                  }
                >
                  {INVITE_POLICY_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                        form.invite_policy === option.value && "border-primary bg-primary/5",
                      )}
                    >
                      <RadioGroupItem value={option.value} className="mt-0.5" />
                      <span>
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Allowed email domains</Label>
                <DomainChips
                  value={form.allowed_domains}
                  onChange={(domains) => set("allowed_domains", domains)}
                />
                <p className="text-xs text-muted-foreground">
                  Invitations and joins are limited to these domains. Empty means anyone can join
                  by invitation.
                </p>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="settings-verify">Require email verification</Label>
                  <p className="text-xs text-muted-foreground">
                    New members can&apos;t access org data until they verify their email address.
                  </p>
                </div>
                <Switch
                  id="settings-verify"
                  checked={form.require_email_verification}
                  onCheckedChange={(checked) => set("require_email_verification", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Security</CardTitle>
              <CardDescription>Sessions and protections for destructive actions.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Field
                label="Session timeout"
                htmlFor="settings-timeout"
                description="How long a member can be idle before they're signed out."
              >
                <Select
                  value={form.session_timeout_minutes}
                  onValueChange={(value) => set("session_timeout_minutes", value)}
                >
                  <SelectTrigger id="settings-timeout" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TIMEOUT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
                <div>
                  <Label htmlFor="settings-reauth">
                    Require re-authentication for destructive actions
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Deactivating or removing members and deleting roles ask for the password again
                    first.
                  </p>
                </div>
                <Switch
                  id="settings-reauth"
                  checked={form.require_reauth_destructive}
                  onCheckedChange={(checked) => set("require_reauth_destructive", checked)}
                />
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                <p className="font-medium">Deactivated members</p>
                <p className="text-muted-foreground">
                  Deactivated members lose access immediately, but their teams, roles, and audit
                  history are kept — reactivate them any time and everything is restored. Nothing
                  is deleted.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Plan</CardTitle>
                <Badge>Free</Badge>
              </div>
              <CardDescription>
                The portfolio demo runs on the Free plan. Limits are informational.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <UsageBar label="Members" used={usage.members} limit={usage.membersLimit} />
              <UsageBar label="Teams" used={usage.teams} limit={usage.teamsLimit} />
              <UsageBar
                label="Custom roles"
                used={usage.customRoles}
                limit={usage.customRolesLimit}
                hint="System roles (Owner, Admin, Manager, Member, Viewer) don't count."
              />
              <UsageBar
                label="Audit retention"
                used={usage.auditRetentionMonths}
                limit={usage.auditRetentionMonths}
                hint="Events are kept for 12 months on the Free plan."
              />
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="text-sm">
                  <p className="font-medium">Need more room?</p>
                  <p className="text-muted-foreground">
                    Paid plans with higher limits are coming soon.
                  </p>
                </div>
                <Button disabled title="Paid plans are coming soon">
                  Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Sticky dirty-state save bar */}
      <div
        aria-live="polite"
        className={cn(
          "sticky bottom-16 z-20 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-8 md:px-8",
          !dirty && "hidden",
        )}
      >
        <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-3">
          <p className="flex-1 text-sm font-medium">
            {saved ? (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Check className="size-4" /> Settings saved.
              </span>
            ) : (
              "You have unsaved changes."
            )}
          </p>
          {error ? (
            <p role="alert" className="w-full text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}
          <Button variant="outline" onClick={discard} disabled={saving}>
            Discard
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </div>
  );
}
