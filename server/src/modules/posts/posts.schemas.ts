import { z } from "zod";

const targetSchema = z.object({
  connectionId: z.string().uuid(),
  caption: z.string().max(5000).optional(),
});

export const createPostSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().max(200).optional(),
  mediaUrl: z.string().url().max(2000).optional(),
  targets: z.array(targetSchema).max(20).optional().default([]),
});

// All fields optional; `null` explicitly clears title/mediaUrl. Providing
// `targets` replaces the whole target set.
export const updatePostSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  mediaUrl: z.string().url().max(2000).nullable().optional(),
  targets: z.array(targetSchema).max(20).optional(),
});

// Publish "now". Visibility defaults to the safest option.
export const publishPostSchema = z.object({
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
});

// Schedule for a future time (ISO 8601). Future-ness is enforced in the service.
export const schedulePostSchema = z.object({
  scheduledFor: z.string().datetime({ offset: true }),
  visibility: z.enum(["private", "unlisted", "public"]).default("private"),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type TargetInput = z.infer<typeof targetSchema>;
export type PublishPostInput = z.infer<typeof publishPostSchema>;
export type SchedulePostInput = z.infer<typeof schedulePostSchema>;
