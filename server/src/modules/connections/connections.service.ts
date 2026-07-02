import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  platformConnections,
  workspaceMembers,
  type PlatformConnection,
  type WorkspaceRole,
} from "../../db/schema";
import { encrypt, encryptNullable } from "../../lib/crypto";
import { forbidden, notFound } from "../../lib/errors";
import * as youtube from "./oauth/youtube.oauth";
import * as instagram from "./oauth/instagram.oauth";
import * as linkedin from "./oauth/linkedin.oauth";
import * as x from "./oauth/x.oauth";

// Only these roles may connect/disconnect social accounts.
const MANAGE_ROLES: WorkspaceRole[] = ["OWNER", "EDITOR"];

/** Throw unless the user is a member of the workspace with a managing role. */
async function assertCanManage(userId: string, workspaceId: string): Promise<void> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  if (!membership) throw forbidden("You are not a member of this workspace", "NOT_A_MEMBER");
  if (!MANAGE_ROLES.includes(membership.role)) {
    throw forbidden("You don't have permission to manage connections", "INSUFFICIENT_ROLE");
  }
}

/** Public projection — never leaks the encrypted tokens. */
const toPublic = (c: PlatformConnection) => ({
  id: c.id,
  platform: c.platform,
  platformAccountId: c.platformAccountId,
  accountName: c.accountName,
  avatarUrl: c.avatarUrl,
  scope: c.scope,
  tokenExpiresAt: c.tokenExpiresAt,
  connectedById: c.connectedById,
  connectedAt: c.createdAt,
});

export const listConnections = async (workspaceId: string) => {
  const rows = await db.query.platformConnections.findMany({
    where: eq(platformConnections.workspaceId, workspaceId),
    orderBy: (t, { desc: d }) => d(t.createdAt),
  });
  return rows.map(toPublic);
};

/** Finish the YouTube OAuth handshake and persist an (encrypted) connection. */
export const completeYoutubeConnection = async (
  userId: string,
  workspaceId: string,
  code: string
) => {
  await assertCanManage(userId, workspaceId);

  const tokens = await youtube.exchangeCode(code);
  const account = await youtube.fetchAccount(tokens.accessToken);

  const values = {
    workspaceId,
    platform: "YOUTUBE" as const,
    platformAccountId: account.id,
    accountName: account.name,
    avatarUrl: account.avatarUrl,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encryptNullable(tokens.refreshToken),
    scope: tokens.scope,
    tokenExpiresAt: tokens.expiresAt,
    connectedById: userId,
    updatedAt: new Date(),
  };

  // Reconnecting the same channel updates the stored tokens in place.
  await db
    .insert(platformConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [
        platformConnections.workspaceId,
        platformConnections.platform,
        platformConnections.platformAccountId,
      ],
      set: {
        accountName: values.accountName,
        avatarUrl: values.avatarUrl,
        accessToken: values.accessToken,
        // Google omits refresh_token on re-consent sometimes — keep the old one if so.
        ...(values.refreshToken ? { refreshToken: values.refreshToken } : {}),
        scope: values.scope,
        tokenExpiresAt: values.tokenExpiresAt,
        connectedById: values.connectedById,
        updatedAt: values.updatedAt,
      },
    });
};

/** Finish the Instagram OAuth handshake and persist an (encrypted) connection. */
export const completeInstagramConnection = async (
  userId: string,
  workspaceId: string,
  code: string
) => {
  await assertCanManage(userId, workspaceId);

  const tokens = await instagram.exchangeCode(code);
  const account = await instagram.fetchAccount(tokens.accessToken);

  const values = {
    workspaceId,
    platform: "INSTAGRAM" as const,
    platformAccountId: account.id,
    accountName: account.name,
    avatarUrl: account.avatarUrl,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encryptNullable(tokens.refreshToken),
    scope: tokens.scope,
    tokenExpiresAt: tokens.expiresAt,
    connectedById: userId,
    updatedAt: new Date(),
  };

  await db
    .insert(platformConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [
        platformConnections.workspaceId,
        platformConnections.platform,
        platformConnections.platformAccountId,
      ],
      set: {
        accountName: values.accountName,
        avatarUrl: values.avatarUrl,
        accessToken: values.accessToken,
        scope: values.scope,
        tokenExpiresAt: values.tokenExpiresAt,
        connectedById: values.connectedById,
        updatedAt: values.updatedAt,
      },
    });
};

/** Finish the LinkedIn OAuth handshake and persist an (encrypted) connection. */
export const completeLinkedinConnection = async (
  userId: string,
  workspaceId: string,
  code: string
) => {
  await assertCanManage(userId, workspaceId);

  const tokens = await linkedin.exchangeCode(code);
  const account = await linkedin.fetchAccount(tokens.accessToken);

  const values = {
    workspaceId,
    platform: "LINKEDIN" as const,
    platformAccountId: account.id,
    accountName: account.name,
    avatarUrl: account.avatarUrl,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encryptNullable(tokens.refreshToken),
    scope: tokens.scope,
    tokenExpiresAt: tokens.expiresAt,
    connectedById: userId,
    updatedAt: new Date(),
  };

  await db
    .insert(platformConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [
        platformConnections.workspaceId,
        platformConnections.platform,
        platformConnections.platformAccountId,
      ],
      set: {
        accountName: values.accountName,
        avatarUrl: values.avatarUrl,
        accessToken: values.accessToken,
        // Keep the existing refresh token if this reconnect didn't return one.
        ...(values.refreshToken ? { refreshToken: values.refreshToken } : {}),
        scope: values.scope,
        tokenExpiresAt: values.tokenExpiresAt,
        connectedById: values.connectedById,
        updatedAt: values.updatedAt,
      },
    });
};

/** Finish the X (Twitter) OAuth handshake and persist an (encrypted) connection. */
export const completeXConnection = async (
  userId: string,
  workspaceId: string,
  code: string,
  pkceVerifier: string
) => {
  await assertCanManage(userId, workspaceId);

  const tokens = await x.exchangeCode(code, pkceVerifier);
  const account = await x.fetchAccount(tokens.accessToken);

  const values = {
    workspaceId,
    platform: "X" as const,
    platformAccountId: account.id,
    accountName: account.name,
    avatarUrl: account.avatarUrl,
    accessToken: encrypt(tokens.accessToken),
    refreshToken: encryptNullable(tokens.refreshToken),
    scope: tokens.scope,
    tokenExpiresAt: tokens.expiresAt,
    connectedById: userId,
    updatedAt: new Date(),
  };

  await db
    .insert(platformConnections)
    .values(values)
    .onConflictDoUpdate({
      target: [
        platformConnections.workspaceId,
        platformConnections.platform,
        platformConnections.platformAccountId,
      ],
      set: {
        accountName: values.accountName,
        avatarUrl: values.avatarUrl,
        accessToken: values.accessToken,
        // X rotates refresh tokens; keep the existing one if none came back.
        ...(values.refreshToken ? { refreshToken: values.refreshToken } : {}),
        scope: values.scope,
        tokenExpiresAt: values.tokenExpiresAt,
        connectedById: values.connectedById,
        updatedAt: values.updatedAt,
      },
    });
};

export const disconnect = async (connectionId: string, userId: string) => {
  const connection = await db.query.platformConnections.findFirst({
    where: eq(platformConnections.id, connectionId),
  });
  if (!connection) throw notFound("Connection not found", "CONNECTION_NOT_FOUND");

  await assertCanManage(userId, connection.workspaceId);
  await db.delete(platformConnections).where(eq(platformConnections.id, connectionId));
};
