"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Mail } from "lucide-react";

import { TIMEZONES } from "@/lib/timezones";
import { updateAccountEmail, updateProfile } from "@/app/(app)/[orgSlug]/profile/actions";
import { ImageUpload } from "@/components/app/image-upload";
import { EmptyState } from "@/components/app/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MyAccessPanel } from "@/components/roles/my-access-panel";
import { cn } from "@/lib/utils";

export interface ReceivedInvitation {
  id: string;
  orgName: string;
  orgSlug: string;
  orgLogoUrl: string | null;
  roleName: string;
  invitedByName: string | null;
  expiresAt: string;
  message: string | null;
}

interface ProfileValues {
  full_name: string;
  title: string;
  bio: string;
  timezone: string;
  avatar_url: string | null;
}

export function ProfileForm({
  orgSlug,
  userId,
  userEmail,
  profile,
  role,
  roleGrant,
  permissions,
  receivedInvites,
}: {
  orgSlug: string;
  userId: string;
  userEmail: string;
  profile: ProfileValues;
  role: { name: string; description: string | null; isSystem: boolean };
  roleGrant: { by: string; at: string } | null;
  permissions: string[];
  receivedInvites: ReceivedInvitation[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProfileValues>(profile);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [emailDraft, setEmailDraft] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(profile),
    [form, profile],
  );

  function set<K extends keyof ProfileValues>(key: K, value: ProfileValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    if (error) setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const result = await updateProfile(orgSlug, {
        full_name: form.full_name,
        title: form.title,
        bio: form.bio,
        timezone: form.timezone,
        avatar_url: form.avatar_url ?? "",
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Couldn't save your profile — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function changeEmail() {
    setEmailBusy(true);
    setEmailMessage(null);
    setEmailError(null);
    try {
      const result = await updateAccountEmail(emailDraft);
      if (!result.ok) {
        setEmailError(result.error);
        return;
      }
      setEmailMessage(result.message);
      setEmailDraft("");
    } catch {
      setEmailError("Couldn't start the email change — try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">My profile</h1>
        <p className="text-muted-foreground">
          How you appear to teammates, and what you can do here.
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="access">My access</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Profile</CardTitle>
              <CardDescription>Visible to members of your organizations.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <Label>Photo</Label>
                <ImageUpload
                  bucket="avatars"
                  path={`${userId}/avatar.png`}
                  currentUrl={form.avatar_url}
                  fallbackLabel={form.full_name || userEmail}
                  onUploaded={(url) => set("avatar_url", url)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={form.full_name}
                  maxLength={80}
                  onChange={(e) => set("full_name", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-title">Title</Label>
                <Input
                  id="profile-title"
                  value={form.title}
                  maxLength={120}
                  placeholder="e.g. Support Lead"
                  onChange={(e) => set("title", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="profile-bio">Bio</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {form.bio.length}/500
                  </span>
                </div>
                <Textarea
                  id="profile-bio"
                  value={form.bio}
                  maxLength={500}
                  rows={3}
                  placeholder="A line or two about what you do."
                  onChange={(e) => set("bio", e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="profile-timezone">Timezone</Label>
                <Select value={form.timezone} onValueChange={(value) => set("timezone", value)}>
                  <SelectTrigger id="profile-timezone" className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Email address</CardTitle>
              <CardDescription>
                Changing your email sends a confirmation link to the new address — it only takes
                effect when you click it.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="flex items-center gap-2 text-sm">
                <Mail className="size-4 text-muted-foreground" />
                <span className="font-medium">{userEmail}</span>
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  value={emailDraft}
                  onChange={(e) => {
                    setEmailDraft(e.target.value);
                    setEmailError(null);
                    setEmailMessage(null);
                  }}
                  placeholder="new-address@example.com"
                  type="email"
                  aria-label="New email address"
                  className="flex-1"
                />
                <Button onClick={changeEmail} disabled={emailBusy || !emailDraft.trim()} variant="outline">
                  {emailBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                  Change email
                </Button>
              </div>
              {emailMessage ? <p className="text-sm text-success">{emailMessage}</p> : null}
              {emailError ? (
                <p role="alert" className="text-sm font-medium text-destructive">
                  {emailError}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access" className="flex flex-col gap-4">
          <MyAccessPanel permissions={permissions} roleName={role.name} roleGrant={roleGrant} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Invitations you&apos;ve received</CardTitle>
              <CardDescription>
                Pending invitations from other organizations.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {receivedInvites.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No pending invitations"
                  description="When another organization invites you, it will show up here — and you can accept or decline it from your account page."
                />
              ) : (
                <div className="flex flex-col gap-2">
                  {receivedInvites.map((invite) => (
                    <div
                      key={invite.id}
                      className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
                    >
                      <Avatar className="size-9 rounded-md">
                        {invite.orgLogoUrl ? <AvatarImage src={invite.orgLogoUrl} alt="" /> : null}
                        <AvatarFallback className="rounded-md text-xs">
                          {invite.orgName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-medium">{invite.orgName}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {invite.roleName}
                          {invite.invitedByName ? ` · invited by ${invite.invitedByName}` : ""}
                        </p>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link href="/account">Review</Link>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
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
              <span className="flex items-center gap-1.5 text-success">
                <Check className="size-4" /> Profile saved.
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
          <Button variant="outline" onClick={() => setForm(profile)} disabled={saving}>
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
