import { eq } from "drizzle-orm";
import { db } from "../../db";
import { posts, type Platform, type PlatformConnection } from "../../db/schema";
import { getFreshYoutubeToken } from "../connections/tokens";
import {
  extractYoutubeVideoId,
  fetchVideoStats,
  type VideoStats,
} from "../connections/oauth/youtube.stats";

export interface TargetAnalytics {
  connectionId: string;
  platform: Platform;
  accountName: string;
  videoId: string | null;
  url: string | null;
  views: number;
  likes: number;
  comments: number;
  error: string | null;
}

export interface PostAnalytics {
  postId: string;
  title: string | null;
  publishedAt: string | null;
  targets: TargetAnalytics[];
}

export interface WorkspaceAnalytics {
  totals: { posts: number; views: number; likes: number; comments: number };
  posts: PostAnalytics[];
}

/**
 * Live analytics for a workspace: for every PUBLISHED target we pull current
 * view/like/comment counts from YouTube. Stats are fetched per connection (one
 * channel/token, batched) and a per-connection failure (e.g. revoked token) is
 * surfaced on its targets without failing the whole response.
 */
export const getWorkspaceAnalytics = async (workspaceId: string): Promise<WorkspaceAnalytics> => {
  const postRows = await db.query.posts.findMany({
    where: eq(posts.workspaceId, workspaceId),
    with: { targets: { with: { connection: true } } },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  // Group published YouTube video ids by connection so we make one batched call per channel.
  const byConnection = new Map<string, { connection: PlatformConnection; ids: string[] }>();
  for (const post of postRows) {
    for (const t of post.targets) {
      if (t.publishStatus !== "PUBLISHED" || t.connection?.platform !== "YOUTUBE") continue;
      const videoId = t.platformPostId ?? extractYoutubeVideoId(t.publishedUrl);
      if (!videoId) continue;
      const entry = byConnection.get(t.connectionId) ?? { connection: t.connection, ids: [] };
      entry.ids.push(videoId);
      byConnection.set(t.connectionId, entry);
    }
  }

  const statsById = new Map<string, VideoStats>();
  const connError = new Map<string, string>();
  for (const [connId, { connection, ids }] of byConnection) {
    try {
      const token = await getFreshYoutubeToken(connection);
      const map = await fetchVideoStats(token, [...new Set(ids)]);
      for (const [id, s] of map) statsById.set(id, s);
    } catch (err) {
      connError.set(connId, err instanceof Error ? err.message.slice(0, 200) : "Couldn't load analytics");
      console.error(`[analytics] stats fetch failed for connection ${connId}:`, err);
    }
  }

  const totals = { posts: 0, views: 0, likes: 0, comments: 0 };
  const outPosts: PostAnalytics[] = [];

  for (const post of postRows) {
    const published = post.targets.filter((t) => t.publishStatus === "PUBLISHED");
    if (!published.length) continue;
    totals.posts++;

    let publishedAt: Date | null = null;
    const targets: TargetAnalytics[] = published.map((t) => {
      const videoId = t.platformPostId ?? extractYoutubeVideoId(t.publishedUrl);
      const stats = videoId ? statsById.get(videoId) : undefined;
      const views = stats?.views ?? 0;
      const likes = stats?.likes ?? 0;
      const comments = stats?.comments ?? 0;
      totals.views += views;
      totals.likes += likes;
      totals.comments += comments;
      if (t.publishedAt && (!publishedAt || t.publishedAt > publishedAt)) publishedAt = t.publishedAt;
      return {
        connectionId: t.connectionId,
        platform: t.connection?.platform ?? "YOUTUBE",
        accountName: t.connection?.accountName ?? "Account",
        videoId,
        url: t.publishedUrl,
        views,
        likes,
        comments,
        // Only report an error when we actually failed to reach the platform.
        error: stats ? null : connError.get(t.connectionId) ?? null,
      };
    });

    outPosts.push({
      postId: post.id,
      title: post.title,
      publishedAt: publishedAt ? (publishedAt as Date).toISOString() : null,
      targets,
    });
  }

  return { totals, posts: outPosts };
};
