"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { slugify } from "@/lib/validations/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrganizationAction } from "../actions";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await createOrganizationAction({ name, slug: effectiveSlug });
    if (!result.ok) {
      setError(result.error ?? "Something went wrong.");
      setPending(false);
      return;
    }

    router.push(`/${result.slug}/dashboard`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-2">
        <Label htmlFor="org-name">Organization name</Label>
        <Input
          id="org-name"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!slugTouched) setSlug(slugify(event.target.value));
          }}
          placeholder="Hale & Fern Studio"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="org-slug">URL slug</Label>
        <div className="flex items-center gap-1.5">
          <span className="shrink-0 text-sm text-muted-foreground">crewspace.app/</span>
          <Input
            id="org-slug"
            required
            minLength={3}
            maxLength={48}
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value.toLowerCase());
            }}
            placeholder="hale-fern-studio"
            pattern="[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"
            title="Lowercase letters, numbers, and hyphens."
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Used in your workspace URL. Lowercase letters, numbers, and hyphens.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending || effectiveSlug.length < 3} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : null}
        Create organization
      </Button>
    </form>
  );
}
