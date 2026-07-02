import { and, eq, inArray, lt, lte, notInArray, or } from "drizzle-orm";
import { db } from "../../db";
import { platformConnections, postTargets, posts, type Post } from "../../db/schema";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { assertWorkspaceRole } from "../../lib/workspaceAuthz";
import {
  assertPublishableMediaUrl,
  isCloudinaryImage,
  toCloudinaryJpeg,
} from "../media/media.service";
import {
  getFreshInstagramToken,
  getFreshLinkedinToken,
  getFreshXToken,
  getFreshYoutubeToken,
} from "../connections/tokens";
import { uploadVideo, type YoutubePrivacy } from "../connections/oauth/youtube.publish";
import { publishImage } from "../connections/oauth/instagram.publish";
import { publishImagePost } from "../connections/oauth/linkedin.publish";
import { publishTweet } from "../connections/oauth/x.publish";
import type { CreatePostInput, TargetInput, UpdatePostInput } from "./posts.schemas";

const EDIT_ROLES = ["OWNER", "EDITOR"] as const;
const REVIEW_ROLES = ["OWNER", "REVIEWER"] as const;
const PUBLISH_ROLES = ["OWNER", "EDITOR"] as const;
const ANY_ROLE = ["OWNER", "EDITOR", "REVIEWER", "VIEWER"] as const;

// A post stuck in PUBLISHING longer than this (e.g. the process died mid-upload)
// may be reaped/re-claimed, so a crash can't strand it forever.
const STALE_PUBLISHING_MS = 10 * 60 * 1000;
// While a publish is genuinely running we bump updatedAt this often, so a slow
// (but live) upload isn't mistaken for a crash by the stale reaper. Must be well
// under STALE_PUBLISHING_MS.
const PUBLISH_HEARTBEAT_MS = 60 * 1000;

async function loadPostOr404(postId: string) {
  const post = await db.query.posts.findFirst({ where: eq(posts.id, postId) });
  if (!post) throw notFound("Post not found", "POST_NOT_FOUND");
  return post;
}

/** Every target connection must exist and belong to this workspace, no dupes. */
async function assertConnectionsInWorkspace(workspaceId: string, targets: TargetInput[]) {
  const ids = targets.map((t) => t.connectionId);
  const unique = [...new Set(ids)];
  if (unique.length !== ids.length) {
    throw badRequest("The same account can't be targeted twice", "DUPLICATE_TARGET");
  }
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: platformConnections.id })
    .from(platformConnections)
    .where(and(eq(platformConnections.workspaceId, workspaceId), inArray(platformConnections.id, unique)));
  if (rows.length !== unique.length) {
    throw badRequest("One or more selected accounts don't belong to this workspace", "INVALID_CONNECTION");
  }
}

async function getDetail(postId: string) {
  const post = await db.query.posts.findFirst({
    where: eq(posts.id, postId),
    with: {
      targets: {
        with: { connection: { columns: { platform: true, accountName: true, avatarUrl: true } } },
      },
    },
  });
  if (!post) throw notFound("Post not found", "POST_NOT_FOUND");
  return {
    id: post.id,
    workspaceId: post.workspaceId,
    title: post.title,
    mediaUrl: post.mediaUrl,
    status: post.status,
    visibility: post.visibility,
    scheduledFor: post.scheduledFor,
    createdById: post.createdById,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
    targets: post.targets
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((t) => ({
        id: t.id,
        connectionId: t.connectionId,
        caption: t.caption,
        publishStatus: t.publishStatus,
        publishedUrl: t.publishedUrl,
        errorMessage: t.errorMessage,
        publishedAt: t.publishedAt,
        connection: t.connection ?? null,
      })),
  };
}

export const createPost = async (userId: string, input: CreatePostInput) => {
  await assertWorkspaceRole(userId, input.workspaceId, [...EDIT_ROLES]);
  const targets = input.targets ?? [];
  await assertConnectionsInWorkspace(input.workspaceId, targets);

  const created = await db.transaction(async (tx) => {
    const [post] = await tx
      .insert(posts)
      .values({
        workspaceId: input.workspaceId,
        createdById: userId,
        title: input.title ?? null,
        mediaUrl: input.mediaUrl ?? null,
      })
      .returning();
    if (targets.length) {
      await tx.insert(postTargets).values(
        targets.map((t) => ({ postId: post.id, connectionId: t.connectionId, caption: t.caption ?? null }))
      );
    }
    return post;
  });

  return getDetail(created.id);
};

export const listPosts = async (workspaceId: string, status?: string) => {
  const where =
    status !== undefined
      ? and(eq(posts.workspaceId, workspaceId), eq(posts.status, status as never))
      : eq(posts.workspaceId, workspaceId);

  const rows = await db.query.posts.findMany({
    where,
    with: { targets: { with: { connection: { columns: { platform: true } } } } },
    orderBy: (t, { desc }) => desc(t.createdAt),
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    mediaUrl: r.mediaUrl,
    status: r.status,
    scheduledFor: r.scheduledFor,
    createdById: r.createdById,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    targetCount: r.targets.length,
    platforms: [...new Set(r.targets.map((t) => t.connection?.platform).filter(Boolean))],
  }));
};

export const getPost = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...ANY_ROLE]);
  return getDetail(postId);
};

export const updatePost = async (postId: string, userId: string, input: UpdatePostInput) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...EDIT_ROLES]);

  if (input.targets !== undefined) {
    await assertConnectionsInWorkspace(post.workspaceId, input.targets);
  }

  await db.transaction(async (tx) => {
    // Atomic guard: the row-locking UPDATE only lands while still DRAFT, so a
    // concurrent submit can't flip the post into review mid-edit.
    const [updated] = await tx
      .update(posts)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.mediaUrl !== undefined ? { mediaUrl: input.mediaUrl } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(posts.id, postId), eq(posts.status, "DRAFT")))
      .returning();
    if (!updated) throw conflict("Only drafts can be edited", "POST_NOT_EDITABLE");

    if (input.targets !== undefined) {
      await tx.delete(postTargets).where(eq(postTargets.postId, postId));
      if (input.targets.length) {
        await tx.insert(postTargets).values(
          input.targets.map((t) => ({ postId, connectionId: t.connectionId, caption: t.caption ?? null }))
        );
      }
    }
  });

  return getDetail(postId);
};

export const deletePost = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...EDIT_ROLES]);
  const [deleted] = await db
    .delete(posts)
    // Never delete a published post, nor one mid-publish (would orphan the upload).
    .where(and(eq(posts.id, postId), notInArray(posts.status, ["PUBLISHED", "PUBLISHING"])))
    .returning();
  if (!deleted) throw conflict("This post can't be deleted while it's published or publishing", "POST_NOT_DELETABLE");
};

export const submitForReview = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...EDIT_ROLES]);

  // Lock the row, re-check status, and re-count targets inside one transaction so
  // a concurrent edit/submit can't race the "must be DRAFT with >=1 target" rule.
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ status: posts.status })
      .from(posts)
      .where(eq(posts.id, postId))
      .for("update");
    if (!locked) throw notFound("Post not found", "POST_NOT_FOUND");
    if (locked.status !== "DRAFT") {
      throw conflict(`Only drafts can be submitted (post is ${locked.status})`, "INVALID_TRANSITION");
    }
    const targets = await tx.query.postTargets.findMany({ where: eq(postTargets.postId, postId) });
    if (!targets.length) throw badRequest("Add at least one account before submitting", "NO_TARGETS");

    await tx.update(posts).set({ status: "PENDING_REVIEW", updatedAt: new Date() }).where(eq(posts.id, postId));
  });
  return getDetail(postId);
};

export const approvePost = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...REVIEW_ROLES]);
  const [updated] = await db
    .update(posts)
    .set({ status: "APPROVED", updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.status, "PENDING_REVIEW")))
    .returning();
  if (!updated) {
    throw conflict(`Only posts pending review can be approved (post is ${post.status})`, "INVALID_TRANSITION");
  }
  return getDetail(postId);
};

export const requestChanges = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...REVIEW_ROLES]);
  const [updated] = await db
    .update(posts)
    .set({ status: "DRAFT", updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.status, "PENDING_REVIEW")))
    .returning();
  if (!updated) {
    throw conflict(`Only posts pending review can be sent back (post is ${post.status})`, "INVALID_TRANSITION");
  }
  return getDetail(postId);
};

const sanitizeYoutubeText = (s: string): string => s.replace(/[<>]/g, "");

/**
 * Publish a post that has ALREADY been atomically claimed into PUBLISHING. Runs
 * each target independently (already-PUBLISHED targets are skipped, so a retry only
 * re-runs failures), then rolls the post up to PUBLISHED (all ok) or FAILED (any
 * error). Wrapped so the post never stays stranded in PUBLISHING on an unexpected
 * throw. Publishes at the post's stored `visibility`. Shared by publish-now + the
 * scheduler.
 */
async function publishClaimedPost(claimed: Post): Promise<void> {
  const postId = claimed.id;
  // Heartbeat: keep bumping updatedAt while we're actively publishing so the stale
  // reaper doesn't mistake a slow-but-live upload for a crashed one (which could
  // otherwise flip us to FAILED and let a concurrent claim re-upload the video).
  const heartbeat = setInterval(() => {
    void db
      .update(posts)
      .set({ updatedAt: new Date() })
      .where(and(eq(posts.id, postId), eq(posts.status, "PUBLISHING")))
      .catch(() => {});
  }, PUBLISH_HEARTBEAT_MS);
  heartbeat.unref();
  try {
    const targets = await db.query.postTargets.findMany({
      where: eq(postTargets.postId, postId),
      with: { connection: true },
    });

    // Shouldn't happen for an approved/scheduled post; mark FAILED (terminal &
    // retryable) rather than stranding — and, for a scheduled post, so the worker
    // doesn't pick it up again in a loop.
    if (!targets.length) {
      await db.update(posts).set({ status: "FAILED", updatedAt: new Date() }).where(eq(posts.id, postId));
      return;
    }

    let anyFailed = false;
    for (const t of targets) {
      if (t.publishStatus === "PUBLISHED") continue; // idempotent retry — don't re-upload
      try {
        const conn = t.connection;
        if (!conn) throw new Error("The connected account was removed.");
        // SSRF guard: only ever publish media we actually hosted on Cloudinary. X
        // can post text-only, so media presence is required per-platform below.
        if (claimed.mediaUrl) assertPublishableMediaUrl(claimed.mediaUrl);

        let result: { id: string; url: string };
        if (conn.platform === "YOUTUBE") {
          if (!claimed.mediaUrl) throw new Error("Add a video before publishing.");
          const accessToken = await getFreshYoutubeToken(conn);
          // Sanitize each candidate BEFORE the fallback so an all-`<>` title still
          // falls back to "Untitled" instead of collapsing to an empty string.
          const title = (
            sanitizeYoutubeText(claimed.title ?? "").trim() ||
            sanitizeYoutubeText(t.caption?.split("\n")[0] ?? "").trim() ||
            "Untitled"
          ).slice(0, 100);
          result = await uploadVideo({
            accessToken,
            mediaUrl: claimed.mediaUrl,
            title,
            description: sanitizeYoutubeText(t.caption ?? ""),
            privacyStatus: claimed.visibility,
          });
        } else if (conn.platform === "INSTAGRAM") {
          if (!claimed.mediaUrl) throw new Error("Add an image before publishing.");
          if (!isCloudinaryImage(claimed.mediaUrl)) {
            throw new Error("Instagram posts need an image — this post's media is a video.");
          }
          const accessToken = await getFreshInstagramToken(conn);
          const caption = [claimed.title?.trim(), t.caption?.trim()]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 2200);
          result = await publishImage({
            accessToken,
            igUserId: conn.platformAccountId,
            imageUrl: toCloudinaryJpeg(claimed.mediaUrl),
            caption,
          });
        } else if (conn.platform === "LINKEDIN") {
          if (!claimed.mediaUrl) throw new Error("Add an image before publishing.");
          if (!isCloudinaryImage(claimed.mediaUrl)) {
            throw new Error("LinkedIn posts need an image — this post's media is a video.");
          }
          const accessToken = await getFreshLinkedinToken(conn);
          const commentary = [claimed.title?.trim(), t.caption?.trim()]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 3000);
          result = await publishImagePost({
            accessToken,
            authorUrn: `urn:li:person:${conn.platformAccountId}`,
            imageUrl: toCloudinaryJpeg(claimed.mediaUrl),
            commentary,
            visibility: claimed.visibility === "public" ? "PUBLIC" : "CONNECTIONS",
          });
        } else if (conn.platform === "X") {
          // X posts a text tweet; if there's an image we attach it (video isn't
          // supported here). Text-only is allowed, so media is optional.
          const accessToken = await getFreshXToken(conn);
          const text = [claimed.title?.trim(), t.caption?.trim()]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 280);
          let imageUrl: string | undefined;
          if (claimed.mediaUrl) {
            if (!isCloudinaryImage(claimed.mediaUrl)) {
              throw new Error("X posts here support text or an image — this post's media is a video.");
            }
            imageUrl = toCloudinaryJpeg(claimed.mediaUrl);
          }
          if (!text && !imageUrl) {
            throw new Error("Add a caption or an image before posting to X.");
          }
          result = await publishTweet({
            accessToken,
            username: conn.accountName,
            text,
            imageUrl,
          });
        } else {
          throw new Error(`Publishing to ${conn.platform} isn't supported yet.`);
        }

        await db
          .update(postTargets)
          .set({
            publishStatus: "PUBLISHED",
            platformPostId: result.id,
            publishedUrl: result.url,
            errorMessage: null,
            publishedAt: new Date(),
          })
          .where(eq(postTargets.id, t.id));
      } catch (err) {
        anyFailed = true;
        const message = err instanceof Error ? err.message : "Publish failed";
        await db
          .update(postTargets)
          .set({ publishStatus: "FAILED", errorMessage: message.slice(0, 500) })
          .where(eq(postTargets.id, t.id));
        console.error(`[publish] post ${postId} target ${t.id} failed:`, err);
      }
    }

    await db
      .update(posts)
      .set({ status: anyFailed ? "FAILED" : "PUBLISHED", updatedAt: new Date() })
      .where(eq(posts.id, postId));
  } catch (err) {
    // Never leave the post stranded in PUBLISHING — mark it FAILED so it's retryable.
    await db
      .update(posts)
      .set({ status: "FAILED", updatedAt: new Date() })
      .where(and(eq(posts.id, postId), eq(posts.status, "PUBLISHING")))
      .catch(() => {});
    throw err;
  } finally {
    clearInterval(heartbeat);
  }
}

/**
 * Publish now. Atomically claims APPROVED|FAILED|SCHEDULED (or a stale PUBLISHING
 * row from a crashed run) into PUBLISHING and records the chosen visibility, so a
 * double-click can't publish twice. Then delegates to publishClaimedPost.
 */
export const publishPost = async (postId: string, userId: string, visibility: YoutubePrivacy) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...PUBLISH_ROLES]);

  const staleBefore = new Date(Date.now() - STALE_PUBLISHING_MS);
  const [claimed] = await db
    .update(posts)
    .set({ status: "PUBLISHING", visibility, updatedAt: new Date() })
    .where(
      and(
        eq(posts.id, postId),
        or(
          inArray(posts.status, ["APPROVED", "FAILED", "SCHEDULED"]),
          and(eq(posts.status, "PUBLISHING"), lt(posts.updatedAt, staleBefore))
        )
      )
    )
    .returning();
  if (!claimed) {
    throw conflict(`Only approved posts can be published (post is ${post.status})`, "INVALID_TRANSITION");
  }

  await publishClaimedPost(claimed);
  return getDetail(postId);
};

/** Schedule an approved post to auto-publish at a future time (with a chosen visibility). */
export const schedulePost = async (
  postId: string,
  userId: string,
  scheduledFor: Date,
  visibility: YoutubePrivacy
) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...PUBLISH_ROLES]);

  if (Number.isNaN(scheduledFor.getTime())) throw badRequest("Invalid schedule time", "INVALID_SCHEDULE");
  if (scheduledFor.getTime() <= Date.now()) {
    throw badRequest("Pick a time in the future", "SCHEDULE_IN_PAST");
  }

  // Schedulable from APPROVED, FAILED (retry), or SCHEDULED (reschedule).
  const [updated] = await db
    .update(posts)
    .set({ status: "SCHEDULED", scheduledFor, visibility, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), inArray(posts.status, ["APPROVED", "FAILED", "SCHEDULED"])))
    .returning();
  if (!updated) {
    throw conflict(`Only approved posts can be scheduled (post is ${post.status})`, "INVALID_TRANSITION");
  }
  return getDetail(postId);
};

/** Cancel a schedule, returning the post to APPROVED. */
export const unschedulePost = async (postId: string, userId: string) => {
  const post = await loadPostOr404(postId);
  await assertWorkspaceRole(userId, post.workspaceId, [...PUBLISH_ROLES]);

  const [updated] = await db
    .update(posts)
    .set({ status: "APPROVED", scheduledFor: null, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.status, "SCHEDULED")))
    .returning();
  if (!updated) {
    throw conflict(`Only scheduled posts can be unscheduled (post is ${post.status})`, "INVALID_TRANSITION");
  }
  return getDetail(postId);
};

/**
 * Scheduler tick (called by a background poller). First reaps posts stranded in
 * PUBLISHING past the stale window (a crashed run) back to FAILED so they're
 * retryable, then atomically claims every due SCHEDULED post into PUBLISHING and
 * publishes it. The atomic claim UPDATE ... RETURNING means overlapping ticks (or
 * multiple instances) can't double-claim the same post.
 */
export const runDuePublishes = async (): Promise<number> => {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - STALE_PUBLISHING_MS);

  await db
    .update(posts)
    .set({ status: "FAILED", updatedAt: now })
    .where(and(eq(posts.status, "PUBLISHING"), lt(posts.updatedAt, staleBefore)));

  const due = await db
    .update(posts)
    .set({ status: "PUBLISHING", updatedAt: now })
    .where(and(eq(posts.status, "SCHEDULED"), lte(posts.scheduledFor, now)))
    .returning();

  for (const post of due) {
    try {
      await publishClaimedPost(post);
    } catch (err) {
      console.error(`[scheduler] publish failed for post ${post.id}:`, err);
    }
  }
  return due.length;
};
