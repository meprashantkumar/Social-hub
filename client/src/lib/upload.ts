import { mediaApi, type UploadSignature } from "@/lib/api";

export interface UploadResult {
  url: string; // Cloudinary secure_url
  resourceType: string; // "image" | "video" | "raw"
  format: string | null;
  bytes: number;
}

/** Cloudinary's free tier caps videos around 100 MB; guard client-side for a friendly error. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Avatars are small images; keep them well under the media cap. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export function isVideoUrl(url: string): boolean {
  return /\/video\/upload\//i.test(url) || /\.(mp4|mov|webm|m4v|avi|mkv|ogv)(\?|$)/i.test(url);
}

export function isImageUrl(url: string): boolean {
  return /\/image\/upload\//i.test(url) || /\.(png|jpe?g|gif|webp|avif|svg|bmp)(\?|$)/i.test(url);
}

/** POST a file to Cloudinary using a server-signed payload, reporting 0–100 progress. */
function postToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`;

  return new Promise<UploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { secure_url?: string; resource_type?: string; format?: string; bytes?: number; error?: { message?: string } } | null = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body?.secure_url) {
        resolve({
          url: body.secure_url,
          resourceType: body.resource_type ?? "raw",
          format: body.format ?? null,
          bytes: body.bytes ?? file.size,
        });
      } else {
        reject(new Error(body?.error?.message ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload. Check your connection and try again."));
    xhr.send(form);
  });
}

/**
 * Upload one file straight to Cloudinary using a server-signed payload, so large
 * videos never pass through our API. Reports progress 0–100 via `onProgress`.
 */
export async function uploadMedia(
  file: File,
  workspaceId: string,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const sig = await mediaApi.signUpload(workspaceId);
  return postToCloudinary(file, sig, onProgress);
}

/** Upload the signed-in user's avatar image to Cloudinary. */
export async function uploadAvatar(
  file: File,
  onProgress?: (pct: number) => void
): Promise<UploadResult> {
  const sig = await mediaApi.signAvatarUpload();
  return postToCloudinary(file, sig, onProgress);
}
