const GRAPH = "https://graph.instagram.com";
const API_VERSION = "v22.0";

const truncate = (s: string, n = 300): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export interface PublishImageParams {
  accessToken: string;
  igUserId: string;
  imageUrl: string; // must be a public JPEG URL
  caption: string;
}

/**
 * Publish a single image to Instagram: create a media container from a public
 * image URL, then publish it. (Reels/video would additionally require polling the
 * container's status until FINISHED — images are ready immediately.)
 */
export async function publishImage(p: PublishImageParams): Promise<{ id: string; url: string }> {
  // 1. Create the media container.
  const createRes = await fetch(`${GRAPH}/${API_VERSION}/${p.igUserId}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      image_url: p.imageUrl,
      caption: p.caption,
      access_token: p.accessToken,
    }),
  });
  if (!createRes.ok) {
    const detail = await createRes.text().catch(() => "");
    throw new Error(`Instagram media create failed (${createRes.status}): ${truncate(detail)}`);
  }
  const created = (await createRes.json()) as { id?: string };
  if (!created.id) throw new Error("Instagram didn't return a media container id.");

  // 2. Publish the container.
  const pubRes = await fetch(`${GRAPH}/${API_VERSION}/${p.igUserId}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ creation_id: created.id, access_token: p.accessToken }),
  });
  if (!pubRes.ok) {
    const detail = await pubRes.text().catch(() => "");
    throw new Error(`Instagram publish failed (${pubRes.status}): ${truncate(detail)}`);
  }
  const published = (await pubRes.json()) as { id?: string };
  if (!published.id) throw new Error("Instagram didn't return a media id.");

  // 3. Best-effort permalink for the published post.
  let url = "https://www.instagram.com/";
  try {
    const permRes = await fetch(
      `${GRAPH}/${API_VERSION}/${published.id}?${new URLSearchParams({
        fields: "permalink",
        access_token: p.accessToken,
      }).toString()}`
    );
    if (permRes.ok) {
      const d = (await permRes.json()) as { permalink?: string };
      if (d.permalink) url = d.permalink;
    }
  } catch {
    /* permalink is non-critical */
  }

  return { id: published.id, url };
}
