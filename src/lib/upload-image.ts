"use client";

/**
 * Client-side image preparation for uploads (org logos, avatars).
 *
 * Guards, per DATABASE-SCHEMA.md §5: 2MB limit, image MIME only, EXIF
 * stripped. EXIF is stripped by re-encoding through a canvas (a fresh bitmap
 * carries no metadata), and the image is downscaled to a sane maximum so
 * originals stay small in private storage.
 */

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const MAX_DIMENSION = 1024;

export class UploadValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadValidationError";
  }
}

/**
 * Validates and re-encodes an image file. Returns a Blob ready for
 * storage.upload(). Throws UploadValidationError for user-facing problems.
 */
export function processImageFile(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new UploadValidationError("Choose an image file (PNG or JPEG).");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("Image must be smaller than 2 MB.");
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new UploadValidationError("This browser can't process images."));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Re-encode through canvas: drops EXIF and normalizes the format.
        const type = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new UploadValidationError("Couldn't read that image — try another."));
              return;
            }
            resolve(blob);
          },
          type,
          0.9,
        );
      } catch {
        reject(new UploadValidationError("Couldn't read that image — try another."));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new UploadValidationError("Couldn't read that image — try another."));
    };
    img.src = url;
  });
}
