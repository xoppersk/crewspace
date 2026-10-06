"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { processImageFile, UploadValidationError } from "@/lib/upload-image";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Image upload with preview — org logos (org-logos bucket) and avatars
 * (avatars bucket). The file is validated + re-encoded client-side, uploaded
 * to private storage, and a long-lived signed URL is minted for display.
 * Calls onUploaded(signedUrl) with the URL to persist.
 */
export function ImageUpload({
  bucket,
  path,
  currentUrl,
  fallbackLabel,
  onUploaded,
  shape = "circle",
  size = "size-20",
}: {
  /** Storage bucket id, e.g. "org-logos" or "avatars". */
  bucket: string;
  /** Object path, e.g. `org-logos/{orgId}/logo.png`. */
  path: string;
  currentUrl: string | null;
  fallbackLabel: string;
  onUploaded: (signedUrl: string) => void;
  shape?: "circle" | "square";
  size?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const blob = await processImageFile(file);
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(path, blob, {
          upsert: true,
          contentType: blob.type || file.type,
        });
      if (uploadError) throw uploadError;
      // Private bucket: mint a long-lived signed URL for display. The URL
      // itself is what's persisted (logo_url / avatar_url).
      const { data, error: signError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (signError || !data?.signedUrl) {
        throw signError ?? new Error("Couldn't create a preview URL.");
      }
      setPreview(data.signedUrl);
      onUploaded(data.signedUrl);
    } catch (err) {
      setError(
        err instanceof UploadValidationError
          ? err.message
          : "Upload failed — check your connection and try again.",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shown = preview ?? currentUrl;

  return (
    <div className="flex items-center gap-4">
      <Avatar className={cn(size, shape === "square" && "rounded-lg")}>
        {shown ? <AvatarImage src={shown} alt="" /> : null}
        <AvatarFallback className={cn(shape === "square" && "rounded-lg")}>
          {fallbackLabel.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1.5">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          className="hidden"
          aria-label="Choose image"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {uploading ? "Uploading…" : shown ? "Change image" : "Upload image"}
        </Button>
        <p className="text-xs text-muted-foreground">PNG or JPEG, under 2 MB.</p>
        {error ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
