import { env } from "../../../config/env";
import { AppError } from "../../../lib/errors";

// "Instagram API with Instagram Login" (direct IG login; no Facebook Page needed).
const AUTH_URL = "https://www.instagram.com/oauth/authorize";
const SHORT_TOKEN_URL = "https://api.instagram.com/oauth/access_token";
const GRAPH = "https://graph.instagram.com";
const API_VERSION = "v22.0";

const SCOPES = ["instagram_business_basic", "instagram_business_content_publish"];

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string | null;
  scope: string | null;
  expiresAt: Date | null;
}

export interface PlatformAccount {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export const isConfigured = (): boolean =>
  Boolean(env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET);

const redirectUri = (): string => `${env.API_BASE_URL}/api/connections/oauth/instagram/callback`;

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(","),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange the auth code for a SHORT-lived token, then immediately swap it for a
 * LONG-lived (~60 day) token we can store. IG has no separate refresh token — the
 * long-lived token itself is later refreshed via ig_refresh_token.
 */
export async function exchangeCode(code: string): Promise<OAuthTokens> {
  // Instagram can append a "#_" fragment to the returned code.
  const cleanCode = code.replace(/#_$/, "");

  const shortRes = await fetch(SHORT_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      client_secret: env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code: cleanCode,
    }),
  });
  if (!shortRes.ok) {
    const detail = await shortRes.text().catch(() => "");
    throw new Error(`Instagram token exchange failed (${shortRes.status}): ${detail}`);
  }
  const short = (await shortRes.json()) as { access_token: string };

  const longRes = await fetch(
    `${GRAPH}/access_token?${new URLSearchParams({
      grant_type: "ig_exchange_token",
      client_secret: env.INSTAGRAM_APP_SECRET!,
      access_token: short.access_token,
    }).toString()}`
  );
  if (!longRes.ok) {
    const detail = await longRes.text().catch(() => "");
    throw new Error(`Instagram long-lived token exchange failed (${longRes.status}): ${detail}`);
  }
  const long = (await longRes.json()) as { access_token: string; expires_in?: number };

  return {
    accessToken: long.access_token,
    refreshToken: null,
    scope: SCOPES.join(","),
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
  };
}

export async function fetchAccount(accessToken: string): Promise<PlatformAccount> {
  const res = await fetch(
    `${GRAPH}/${API_VERSION}/me?${new URLSearchParams({
      fields: "user_id,username",
      access_token: accessToken,
    }).toString()}`
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Instagram account fetch failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as { user_id?: string; id?: string; username?: string };
  const id = data.user_id ?? data.id;
  if (!id) throw new AppError(400, "Couldn't read your Instagram account", "NO_IG_ACCOUNT");
  return { id: String(id), name: data.username ?? "Instagram account", avatarUrl: null };
}

/** Refresh a long-lived token (valid if it's >24h old and not expired). */
export async function refreshAccessToken(
  accessToken: string
): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const res = await fetch(
    `${GRAPH}/refresh_access_token?${new URLSearchParams({
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    }).toString()}`
  );
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[instagram] token refresh failed (${res.status}): ${detail}`);
    throw new Error("Couldn't refresh the Instagram connection — please reconnect the account.");
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}
