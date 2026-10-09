"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { slugify } from "@/lib/validations/org";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { checkSlugAvailability, createOrganizationAction } from "../actions";

export function CreateOrgForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live slug availability (debounced 300ms). Async writes happen inside the
  // timeout callback; the visible status derives during render so no setState
  // runs synchronously in the effect body.
  const [availability, setAvailability] = useState<{
    available: boolean;
    suggestions: string[];
  } | null>(null);
  const [checkedSlug, setCheckedSlug] = useState("");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (effectiveSlug.length < 3) {
        setAvailability(null);
        setCheckedSlug("");
        return;
      }
      void checkSlugAvailability(effectiveSlug).then((result) => {
        setAvailability(result);
        setCheckedSlug(effectiveSlug);
      });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [effectiveSlug]);

  const slugStatus =
    effectiveSlug.length < 3
      ? "idle"
      : checkedSlug !== effectiveSlug
        ? "checking"
        : availability?.available
          ? "available"
          : "taken";

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
          disabled={pending}
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
            disabled={pending}
            aria-describedby="org-slug-status"
          />
        </div>
        <div id="org-slug-status" className="min-h-5 text-xs" aria-live="polite">
          {slugStatus === "checking" ? (
            <span className="text-muted-foreground">Checking availability…</span>
          ) : slugStatus === "available" ? (
            <span className="flex items-center gap-1 text-success">
              <CheckCircle2 className="size-3.5" /> Available
            </span>
          ) : slugStatus === "taken" ? (
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="flex items-center gap-1 text-destructive">
                <XCircle className="size-3.5" /> Taken — try one of these:
              </span>
              {(availability?.suggestions ?? []).map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => {
                    setSlugTouched(true);
                    setSlug(suggestion);
                  }}
                  className="rounded-full border px-2 py-0.5 font-medium text-foreground hover:border-primary hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">
              Used in your workspace URL. Lowercase letters, numbers, and hyphens.
            </span>
          )}
        </div>
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
