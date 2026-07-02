import { relations } from "drizzle-orm";
import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Users. Passwords are stored as bcrypt hashes (never plaintext).
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Refresh tokens. Each row's id is the JWT `jti`. We track these server-side so
 * that logout, rotation, and reuse-detection actually work (stateless JWTs alone
 * cannot be revoked).
 */
export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    replacedById: uuid("replaced_by_id"),
    userAgent: text("user_agent"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("refresh_tokens_user_idx").on(table.userId)]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;

// ---------------------------------------------------------------------------
// Workspaces & team membership
// ---------------------------------------------------------------------------

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "OWNER",
  "EDITOR",
  "REVIEWER",
  "VIEWER",
]);

export const invitationStatusEnum = pgEnum("invitation_status", [
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("EDITOR"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("workspace_members_ws_user_uq").on(table.workspaceId, table.userId),
    index("workspace_members_user_idx").on(table.userId),
  ]
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRoleEnum("role").notNull().default("EDITOR"),
    token: text("token").notNull().unique(),
    status: invitationStatusEnum("status").notNull().default("PENDING"),
    invitedById: uuid("invited_by_id")
      .notNull()
      .references(() => users.id),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workspace_invitations_ws_idx").on(table.workspaceId),
    index("workspace_invitations_email_idx").on(table.email),
  ]
);

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  owner: one(users, { fields: [workspaces.ownerId], references: [users.id] }),
}));

export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, { fields: [workspaceMembers.userId], references: [users.id] }),
}));

export const workspaceInvitationsRelations = relations(workspaceInvitations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceInvitations.workspaceId],
    references: [workspaces.id],
  }),
  invitedBy: one(users, {
    fields: [workspaceInvitations.invitedById],
    references: [users.id],
  }),
}));

export type Workspace = typeof workspaces.$inferSelect;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect;
export type WorkspaceRole = (typeof workspaceRoleEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Platform connections (OAuth-linked social accounts)
// ---------------------------------------------------------------------------

export const platformEnum = pgEnum("platform", ["YOUTUBE", "INSTAGRAM", "LINKEDIN", "X"]);

export const platformConnections = pgTable(
  "platform_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    platform: platformEnum("platform").notNull(),
    // The platform's own account/channel id (e.g. YouTube channel id).
    platformAccountId: text("platform_account_id").notNull(),
    accountName: text("account_name").notNull(),
    avatarUrl: text("avatar_url"),
    // Both tokens are AES-256-GCM encrypted before persisting.
    accessToken: text("access_token").notNull(),
    refreshToken: text("refresh_token"),
    scope: text("scope"),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    connectedById: uuid("connected_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("platform_connections_ws_platform_account_uq").on(
      table.workspaceId,
      table.platform,
      table.platformAccountId
    ),
    index("platform_connections_ws_idx").on(table.workspaceId),
  ]
);

export const platformConnectionsRelations = relations(platformConnections, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [platformConnections.workspaceId],
    references: [workspaces.id],
  }),
}));

export type PlatformConnection = typeof platformConnections.$inferSelect;
export type Platform = (typeof platformEnum.enumValues)[number];

// ---------------------------------------------------------------------------
// Posts & per-platform targets
// ---------------------------------------------------------------------------

export const postStatusEnum = pgEnum("post_status", [
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  // Transient: set while a publish is in flight so a double-click can't publish twice.
  "PUBLISHING",
]);

// How a published video should be visible on the platform.
export const publishVisibilityEnum = pgEnum("publish_visibility", ["private", "unlisted", "public"]);

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    title: text("title"),
    mediaUrl: text("media_url"),
    status: postStatusEnum("status").notNull().default("DRAFT"),
    // Chosen platform visibility; used by publish-now and the scheduler.
    visibility: publishVisibilityEnum("visibility").notNull().default("private"),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("posts_ws_idx").on(table.workspaceId)]
);

export const postTargets = pgTable(
  "post_targets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    postId: uuid("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    connectionId: uuid("connection_id")
      .notNull()
      .references(() => platformConnections.id, { onDelete: "cascade" }),
    caption: text("caption"),
    publishStatus: postStatusEnum("publish_status").notNull().default("DRAFT"),
    // The platform's own id for the published item (e.g. YouTube video id) — used to fetch analytics.
    platformPostId: text("platform_post_id"),
    publishedUrl: text("published_url"),
    errorMessage: text("error_message"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("post_targets_post_connection_uq").on(table.postId, table.connectionId),
    index("post_targets_post_idx").on(table.postId),
  ]
);

export const postsRelations = relations(posts, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [posts.workspaceId], references: [workspaces.id] }),
  createdBy: one(users, { fields: [posts.createdById], references: [users.id] }),
  targets: many(postTargets),
}));

export const postTargetsRelations = relations(postTargets, ({ one }) => ({
  post: one(posts, { fields: [postTargets.postId], references: [posts.id] }),
  connection: one(platformConnections, {
    fields: [postTargets.connectionId],
    references: [platformConnections.id],
  }),
}));

export type Post = typeof posts.$inferSelect;
export type PostTarget = typeof postTargets.$inferSelect;
export type PostStatus = (typeof postStatusEnum.enumValues)[number];
export type PublishVisibility = (typeof publishVisibilityEnum.enumValues)[number];
