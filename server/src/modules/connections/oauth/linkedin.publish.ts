import { env } from "../../../config/env";

// LinkedIn versioned REST API (Posts + Images). The monthly version is sent as a
// header and comes from env so it can be bumped when LinkedIn deprecates one.
const REST_BASE = "https://api.linkedin.com/rest";

export interface PublishImageArgs {
  accessToken: string;
  authorUrn: string; // urn:li:person:{sub}
  imageUrl: string; // public https (Cloudinary) image URL
  commentary: string; // raw text; escaped here for LinkedIn's "little text" format
  visibility: "PUBLIC" | "CONNECTIONS";
}

function versionedHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    "LinkedIn-Version": env.LINKEDIN_API_VERSION,
    "X-Restli-Protocol-Version": "2.0.0",
  };
}

/**
 * LinkedIn's `commentary` field uses a "little text" format where these characters
 * are reserved and must be backslash-escaped or the Posts API rejects the request.
 * Escaping the backslash is handled by the same pass (it's in the class).
 */
function escapeCommentary(text: string): string {
  return text.replace(/[\\<>#~_|{}@[\]()*]/g, (c) => `\\${c}`);
}

/** Register an image upload, PUT the bytes, and return the resulting image URN. */
async function uploadImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string
): Promise<string> {
  const initRes = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: { ...versionedHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify({ initializeUploadRequest: { owner: authorUrn } }),
  });
  if (!initRes.ok) {
    const detail = await initRes.text().catch(() => "");
    throw new Error(`LinkedIn image init failed (${initRes.status}): ${detail}`);
  }
  const init = (await initRes.json()) as { value?: { uploadUrl?: string; image?: string } };
  const uploadUrl = init.value?.uploadUrl;
  const imageUrn = init.value?.image;
  if (!uploadUrl || !imageUrn) throw new Error("LinkedIn image init returned no upload URL");

  // Fetch the source bytes (the caller has already SSRF-guarded this URL) and
  // upload them to the pre-signed LinkedIn URL.
  const srcRes = await fetch(imageUrl);
  if (!srcRes.ok) throw new Error(`Couldn't fetch the image to upload (${srcRes.status})`);
  const bytes = Buffer.from(await srcRes.arrayBuffer());

  const upRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: bytes,
  });
  if (!upRes.ok) {
    const detail = await upRes.text().catch(() => "");
    throw new Error(`LinkedIn image upload failed (${upRes.status}): ${detail}`);
  }
  return imageUrn;
}

/** Publish a single-image feed post on behalf of a member. */
export async function publishImagePost(
  args: PublishImageArgs
): Promise<{ id: string; url: string }> {
  const { accessToken, authorUrn, imageUrl, commentary, visibility } = args;

  const imageUrn = await uploadImage(accessToken, authorUrn, imageUrl);

  const body = {
    author: authorUrn,
    commentary: escapeCommentary(commentary),
    visibility,
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      media: {
        id: imageUrn,
        altText: (commentary.trim() || "Image").slice(0, 300),
      },
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const res = await fetch(`${REST_BASE}/posts`, {
    method: "POST",
    headers: { ...versionedHeaders(accessToken), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LinkedIn post failed (${res.status}): ${detail}`);
  }
  // The created post URN comes back in a response header (not the body).
  const urn = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
  const url = urn ? `https://www.linkedin.com/feed/update/${urn}/` : "https://www.linkedin.com/feed/";
  return { id: urn, url };
}
