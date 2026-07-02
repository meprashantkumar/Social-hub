import { env } from "../../../config/env";
import { AppError } from "../../../lib/errors";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
];

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
  Boolean(env.YOUTUBE_CLIENT_ID && env.YOUTUBE_CLIENT_SECRET);

const redirectUri = (): string => `${env.API_BASE_URL}/api/connections/oauth/youtube/callback`;

/** Build the Google consent URL. `offline` + `consent` are required to get a refresh token. */
export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.YOUTUBE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.YOUTUBE_CLIENT_ID!,
      client_secret: env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`YouTube token exchange failed (${res.status}): ${detail}`);
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

/**
 * Exchange a stored refresh token for a fresh access token. Google does NOT
 * return a new refresh token here, so callers keep the existing one.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresAt: Date | null }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.YOUTUBE_CLIENT_ID!,
      client_secret: env.YOUTUBE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    // Log the provider detail server-side only — never surface the token-endpoint
    // response to the client (it ends up in a target's errorMessage otherwise).
    const detail = await res.text().catch(() => "");
    console.error(`[youtube] token refresh failed (${res.status}): ${detail}`);
    throw new Error("Couldn't refresh the YouTube connection — please reconnect the account.");
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return {
    accessToken: data.access_token,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

export async function fetchAccount(accessToken: string): Promise<PlatformAccount> {
  const res = await fetch(CHANNELS_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`YouTube channel fetch failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    items?: Array<{ id: string; snippet?: { title?: string; thumbnails?: { default?: { url?: string } } } }>;
  };
  const channel = data.items?.[0];
  if (!channel) {
    throw new AppError(400, "This Google account has no YouTube channel", "NO_CHANNEL");
  }
  return {
    id: channel.id,
    name: channel.snippet?.title ?? "YouTube channel",
    avatarUrl: channel.snippet?.thumbnails?.default?.url ?? null,
  };
}
