import { createHash } from "node:crypto";
import { env } from "../../../config/env";
import { AppError } from "../../../lib/errors";

// X (Twitter) API v2 — OAuth 2.0 Authorization Code with PKCE, confidential client
// (we hold a client secret, so token requests use HTTP Basic auth).
const AUTH_URL = "https://twitter.com/i/oauth2/authorize";
const TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const ME_URL = "https://api.twitter.com/2/users/me";

// tweet.write → post; users.read → identity; media.write → attach images;
// offline.access → get a refresh token (X access tokens only last ~2h).
const SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"];

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

export const isConfigured = (): boolean => Boolean(env.X_CLIENT_ID && env.X_CLIENT_SECRET);

const redirectUri = (): string => `${env.API_BASE_URL}/api/connections/oauth/x/callback`;

const basicAuth = (): string =>
  "Basic " + Buffer.from(`${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`).toString("base64");

// PKCE: the challenge is the base64url SHA-256 of the verifier. The verifier itself
// is kept in a cookie by the controller and only sent at token exchange.
const codeChallenge = (verifier: string): string =>
  createHash("sha256").update(verifier).digest("base64url");

export function getAuthUrl(state: string, pkceVerifier: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.X_CLIENT_ID!,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge(pkceVerifier),
    code_challenge_method: "S256",
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string, pkceVerifier: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(),
      code_verifier: pkceVerifier,
      client_id: env.X_CLIENT_ID!,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`X token exchange failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    scope: data.scope ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

/** Refresh an access token. X rotates the refresh token, so persist the new one. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: basicAuth(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.X_CLIENT_ID!,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[x] token refresh failed (${res.status}): ${detail}`);
    throw new Error("Couldn't refresh the X connection — please reconnect the account.");
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

export async function fetchAccount(accessToken: string): Promise<PlatformAccount> {
  const res = await fetch(`${ME_URL}?user.fields=profile_image_url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`X account fetch failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    data?: { id?: string; name?: string; username?: string; profile_image_url?: string };
  };
  const u = data.data;
  if (!u?.id) throw new AppError(400, "Couldn't read your X account", "NO_X_ACCOUNT");
  // Store the @handle as the account name — it's how X users are identified and it
  // lets us build the tweet permalink.
  return {
    id: u.id,
    name: u.username ?? u.name ?? "X account",
    avatarUrl: u.profile_image_url ?? null,
  };
}
