import { eq } from "drizzle-orm";
import { db } from "../../db";
import { platformConnections, type PlatformConnection } from "../../db/schema";
import { decrypt, encrypt } from "../../lib/crypto";
import { refreshAccessToken } from "./oauth/youtube.oauth";
import * as instagram from "./oauth/instagram.oauth";
import * as linkedin from "./oauth/linkedin.oauth";
import * as x from "./oauth/x.oauth";

// Refresh the access token if it expires within this window (or its expiry is unknown).
const TOKEN_REFRESH_SKEW_MS = 60_000;
// Instagram long-lived tokens last ~60 days; refresh when they get within a week
// of expiry (and only while still valid — an expired IG token can't be refreshed).
const IG_REFRESH_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Return a valid YouTube access token for a connection, refreshing + persisting
 * (re-encrypted) if it's stale. Shared by publishing and analytics.
 */
export async function getFreshYoutubeToken(connection: PlatformConnection): Promise<string> {
  const staleOrUnknown =
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_SKEW_MS;

  // Nothing to refresh with — use what we have and let the API reject if it's dead.
  if (!staleOrUnknown || !connection.refreshToken) {
    return decrypt(connection.accessToken);
  }

  const refreshed = await refreshAccessToken(decrypt(connection.refreshToken));
  await db
    .update(platformConnections)
    .set({
      accessToken: encrypt(refreshed.accessToken),
      tokenExpiresAt: refreshed.expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(platformConnections.id, connection.id));
  return refreshed.accessToken;
}

/**
 * Return a valid Instagram access token, refreshing + persisting when it's close
 * to expiry (but still valid). If it's already expired we return it as-is and let
 * the API reject it, prompting a reconnect.
 */
export async function getFreshInstagramToken(connection: PlatformConnection): Promise<string> {
  const token = decrypt(connection.accessToken);
  const expiresAt = connection.tokenExpiresAt?.getTime();
  const expired = expiresAt !== undefined && expiresAt <= Date.now();
  const nearExpiry = expiresAt === undefined || expiresAt - Date.now() < IG_REFRESH_SKEW_MS;
  if (expired || !nearExpiry) return token;

  try {
    const refreshed = await instagram.refreshAccessToken(token);
    await db
      .update(platformConnections)
      .set({
        accessToken: encrypt(refreshed.accessToken),
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, connection.id));
    return refreshed.accessToken;
  } catch {
    return token; // refresh failed; fall back to the existing token
  }
}

/**
 * Return a valid LinkedIn access token, refreshing + persisting when it's stale.
 * A standard LinkedIn app has no refresh token (60-day access token then reconnect),
 * so we only refresh when one was actually stored; LinkedIn rotates the refresh
 * token, so we persist the new one when returned.
 */
export async function getFreshLinkedinToken(connection: PlatformConnection): Promise<string> {
  const staleOrUnknown =
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_SKEW_MS;

  if (!staleOrUnknown || !connection.refreshToken) {
    return decrypt(connection.accessToken);
  }

  try {
    const refreshed = await linkedin.refreshAccessToken(decrypt(connection.refreshToken));
    await db
      .update(platformConnections)
      .set({
        accessToken: encrypt(refreshed.accessToken),
        ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, connection.id));
    return refreshed.accessToken;
  } catch {
    return decrypt(connection.accessToken); // refresh failed; let the API reject if dead
  }
}

/**
 * Return a valid X (Twitter) access token. X access tokens are short-lived (~2h)
 * but come with a refresh token (offline.access). Refresh + persist when stale;
 * X rotates the refresh token, so we store the new one.
 */
export async function getFreshXToken(connection: PlatformConnection): Promise<string> {
  const staleOrUnknown =
    !connection.tokenExpiresAt ||
    connection.tokenExpiresAt.getTime() - Date.now() < TOKEN_REFRESH_SKEW_MS;

  if (!staleOrUnknown || !connection.refreshToken) {
    return decrypt(connection.accessToken);
  }

  try {
    const refreshed = await x.refreshAccessToken(decrypt(connection.refreshToken));
    await db
      .update(platformConnections)
      .set({
        accessToken: encrypt(refreshed.accessToken),
        ...(refreshed.refreshToken ? { refreshToken: encrypt(refreshed.refreshToken) } : {}),
        tokenExpiresAt: refreshed.expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(platformConnections.id, connection.id));
    return refreshed.accessToken;
  } catch {
    return decrypt(connection.accessToken); // refresh failed; let the API reject if dead
  }
}
