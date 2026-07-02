const VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

export interface VideoStats {
  views: number;
  likes: number;
  comments: number;
}

/** Pull the video id out of a watch URL (fallback for rows saved before platformPostId existed). */
export function extractYoutubeVideoId(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).searchParams.get("v");
  } catch {
    return null;
  }
}

/**
 * Fetch statistics for up to any number of video ids (batched at YouTube's 50/call
 * limit). Returns a map of videoId -> stats; ids YouTube doesn't return (deleted /
 * not visible) are simply absent.
 */
export async function fetchVideoStats(
  accessToken: string,
  ids: string[]
): Promise<Map<string, VideoStats>> {
  const out = new Map<string, VideoStats>();
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const params = new URLSearchParams({ part: "statistics", id: batch.join(","), maxResults: "50" });
    const res = await fetch(`${VIDEOS_URL}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`YouTube stats fetch failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as {
      items?: Array<{ id: string; statistics?: Record<string, string> }>;
    };
    for (const item of data.items ?? []) {
      const s = item.statistics ?? {};
      out.set(item.id, {
        views: Number(s.viewCount ?? 0),
        likes: Number(s.likeCount ?? 0),
        comments: Number(s.commentCount ?? 0),
      });
    }
  }
  return out;
}
