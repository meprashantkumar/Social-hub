// X (Twitter) API v2 publishing. Posts a text tweet, optionally with one image.
const TWEETS_URL = "https://api.twitter.com/2/tweets";
const MEDIA_UPLOAD_URL = "https://api.twitter.com/2/media/upload";

export interface PublishTweetArgs {
  accessToken: string;
  username: string; // the @handle, used to build the permalink
  text: string;
  imageUrl?: string | null; // public https (Cloudinary) image URL
}

/** Upload one image and return its media id (requires the media.write scope). */
async function uploadImage(accessToken: string, imageUrl: string): Promise<string> {
  const src = await fetch(imageUrl);
  if (!src.ok) throw new Error(`Couldn't fetch the image to upload (${src.status})`);
  const bytes = Buffer.from(await src.arrayBuffer());
  const contentType = src.headers.get("content-type") ?? "image/jpeg";

  const form = new FormData();
  form.append("media", new Blob([bytes], { type: contentType }), "image");
  form.append("media_category", "tweet_image");

  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`X media upload failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    data?: { id?: string };
    media_id_string?: string;
    id?: string;
  };
  const id = data.data?.id ?? data.media_id_string ?? data.id;
  if (!id) throw new Error("X media upload returned no media id");
  return String(id);
}

export async function publishTweet(args: PublishTweetArgs): Promise<{ id: string; url: string }> {
  const { accessToken, username, text, imageUrl } = args;

  const mediaId = imageUrl ? await uploadImage(accessToken, imageUrl) : undefined;

  const body: Record<string, unknown> = {};
  if (text) body.text = text;
  if (mediaId) body.media = { media_ids: [mediaId] };

  const res = await fetch(TWEETS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`X post failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { data?: { id?: string } };
  const id = data.data?.id ?? "";
  const url = id ? `https://x.com/${username}/status/${id}` : `https://x.com/${username}`;
  return { id, url };
}
