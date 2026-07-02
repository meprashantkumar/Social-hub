/**
 * Uploads a video to YouTube via the Data API v3 resumable-upload protocol:
 *   1. Fetch the media (from Cloudinary) into memory.
 *   2. Open a resumable session (POST metadata) -> returns an upload URL.
 *   3. PUT the bytes to that URL -> returns the created video resource.
 *
 * The whole file is buffered in memory, which is fine for the short clips this
 * app targets; moving to a streamed/background upload is a later (scheduling) step.
 */
const RESUMABLE_INIT_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

// Hard cap on how much media we'll buffer, so a huge/oversized file can't OOM the
// process. Comfortably above the 100 MB client-side upload limit.
const MAX_MEDIA_BYTES = 200 * 1024 * 1024;
const MEDIA_FETCH_TIMEOUT_MS = 120_000;

export type YoutubePrivacy = "private" | "unlisted" | "public";

export interface UploadParams {
  accessToken: string;
  mediaUrl: string;
  title: string;
  description: string;
  privacyStatus: YoutubePrivacy;
}

const truncate = (s: string, n = 300): string => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function uploadVideo(p: UploadParams): Promise<{ id: string; url: string }> {
  // 1. Pull the media file down from Cloudinary. `redirect: "error"` stops a
  // delivery URL from bouncing us to some other (internal) host, and the timeout
  // + size caps bound how much we'll download/buffer.
  let mediaRes: Response;
  try {
    mediaRes = await fetch(p.mediaUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(MEDIA_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new Error("Couldn't reach the media file to upload.");
  }
  if (!mediaRes.ok) {
    throw new Error(`Couldn't fetch the media file (${mediaRes.status}).`);
  }
  const contentType = mediaRes.headers.get("content-type") ?? "application/octet-stream";
  if (!contentType.startsWith("video/")) {
    throw new Error("YouTube only accepts video files — this post's media isn't a video.");
  }
  const declaredLength = Number(mediaRes.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MEDIA_BYTES) {
    throw new Error("The media file is too large to publish.");
  }
  const bytes = Buffer.from(await mediaRes.arrayBuffer());
  if (bytes.length === 0) throw new Error("The media file is empty.");
  if (bytes.length > MAX_MEDIA_BYTES) throw new Error("The media file is too large to publish.");

  // 2. Open a resumable upload session.
  const initRes = await fetch(RESUMABLE_INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${p.accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": contentType,
      "X-Upload-Content-Length": String(bytes.length),
    },
    body: JSON.stringify({
      snippet: { title: p.title, description: p.description },
      status: { privacyStatus: p.privacyStatus, selfDeclaredMadeForKids: false },
    }),
  });
  if (!initRes.ok) {
    const detail = await initRes.text().catch(() => "");
    throw new Error(`YouTube upload init failed (${initRes.status}): ${truncate(detail)}`);
  }
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("YouTube didn't return an upload URL.");

  // 3. Upload the bytes to the session URL.
  // KNOWN LIMITATION (at-least-once): if YouTube receives the bytes but the
  // response is lost (socket reset), the caller marks the target FAILED and a
  // retry uploads again, creating a duplicate video. A fully idempotent fix means
  // persisting `uploadUrl` and resuming the same session (Content-Range bytes */size)
  // instead of re-POSTing — deferred to the background-publish (scheduling) phase.
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: bytes,
  });
  if (!uploadRes.ok) {
    const detail = await uploadRes.text().catch(() => "");
    throw new Error(`YouTube upload failed (${uploadRes.status}): ${truncate(detail)}`);
  }
  const data = (await uploadRes.json().catch(() => null)) as { id?: string } | null;
  if (!data?.id) throw new Error("YouTube didn't return a video id.");

  return { id: data.id, url: `https://www.youtube.com/watch?v=${data.id}` };
}
