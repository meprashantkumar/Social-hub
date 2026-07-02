import { createHash } from "node:crypto";
import { env } from "../../config/env";
import { AppError, badRequest } from "../../lib/errors";

// Cloudinary serves all delivery URLs from this host.
const CLOUDINARY_DELIVERY_HOST = "res.cloudinary.com";

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/** True only when all three Cloudinary values are present. */
export function isConfigured(): boolean {
  return Boolean(
    env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
  );
}

/**
 * Build a Cloudinary signature so the browser can upload the file DIRECTLY to
 * Cloudinary (large videos never touch our server). The api_secret stays here;
 * only the derived signature + the public cloud_name/api_key go to the client.
 *
 * Cloudinary signs the SHA-1 of the request params (except file, cloud_name,
 * resource_type, api_key, signature), sorted alphabetically and joined with "&",
 * with the api_secret appended. We only sign `folder` + `timestamp`, so the
 * client must send exactly those (plus file/api_key) and nothing else signed.
 */
export function signUpload(workspaceId: string): UploadSignature {
  if (!isConfigured()) {
    throw new AppError(501, "Media uploads are not configured on the server", "MEDIA_NOT_CONFIGURED");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `socialhub/${workspaceId}`;

  const paramsToSign: Record<string, string | number> = { folder, timestamp };
  const canonical = Object.keys(paramsToSign)
    .sort()
    .map((key) => `${key}=${paramsToSign[key]}`)
    .join("&");

  const signature = createHash("sha1")
    .update(canonical + env.CLOUDINARY_API_SECRET)
    .digest("hex");

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME!,
    apiKey: env.CLOUDINARY_API_KEY!,
    timestamp,
    folder,
    signature,
  };
}

/**
 * SSRF guard for server-side media fetches (e.g. before uploading to YouTube).
 * Only allow the media we actually hosted: an https Cloudinary delivery URL for
 * the configured cloud. This blocks arbitrary/internal hosts, non-https schemes,
 * and cloud-metadata endpoints.
 */
export function assertPublishableMediaUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw badRequest("Invalid media URL", "INVALID_MEDIA_URL");
  }
  const ok =
    parsed.protocol === "https:" &&
    parsed.hostname === CLOUDINARY_DELIVERY_HOST &&
    (!env.CLOUDINARY_CLOUD_NAME || parsed.pathname.startsWith(`/${env.CLOUDINARY_CLOUD_NAME}/`));
  if (!ok) {
    throw badRequest(
      "This media can't be published — upload the file through SocialHub first.",
      "MEDIA_NOT_UPLOADED"
    );
  }
}

/** True if a Cloudinary delivery URL points at an image (vs a video). */
export function isCloudinaryImage(url: string): boolean {
  return url.includes("/image/upload/");
}

/** Force JPEG delivery of a Cloudinary image (Instagram rejects PNG/WebP for feed posts). */
export function toCloudinaryJpeg(url: string): string {
  return url.replace("/image/upload/", "/image/upload/f_jpg,q_auto/");
}
