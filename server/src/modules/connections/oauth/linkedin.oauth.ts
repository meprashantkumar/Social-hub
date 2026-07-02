import { env } from "../../../config/env";
import { AppError } from "../../../lib/errors";

// LinkedIn OAuth 2.0 (3-legged) + OpenID Connect for identity.
const AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";

// openid/profile/email → member identity via /userinfo (the "Sign In with LinkedIn
// using OpenID Connect" product); w_member_social → create posts ("Share on LinkedIn").
const SCOPES = ["openid", "profile", "email", "w_member_social"];

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
  Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);

const redirectUri = (): string => `${env.API_BASE_URL}/api/connections/oauth/linkedin/callback`;

export function getAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.LINKEDIN_CLIENT_ID!,
    redirect_uri: redirectUri(),
    scope: SCOPES.join(" "),
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<OAuthTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.LINKEDIN_CLIENT_ID!,
      client_secret: env.LINKEDIN_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    // Only present if the app is enrolled in programmatic refresh tokens; a
    // standard app just gets a ~60-day access token and must reconnect after.
    refresh_token?: string;
    scope?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    scope: data.scope ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

/** Exchange a stored refresh token for a fresh one. LinkedIn rotates the refresh
 * token, so callers should persist the returned refreshToken when present. */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: env.LINKEDIN_CLIENT_ID!,
      client_secret: env.LINKEDIN_CLIENT_SECRET!,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error(`[linkedin] token refresh failed (${res.status}): ${detail}`);
    throw new Error("Couldn't refresh the LinkedIn connection — please reconnect the account.");
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? null,
    expiresAt: data.expires_in ? new Date(Date.now() + data.expires_in * 1000) : null,
  };
}

export async function fetchAccount(accessToken: string): Promise<PlatformAccount> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`LinkedIn profile fetch failed (${res.status}): ${detail}`);
  }
  const data = (await res.json()) as {
    sub?: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
  };
  // `sub` is the member id; the person URN we post as is `urn:li:person:{sub}`.
  if (!data.sub) {
    throw new AppError(400, "Couldn't read your LinkedIn profile", "NO_LI_ACCOUNT");
  }
  const name =
    data.name?.trim() ||
    [data.given_name, data.family_name].filter(Boolean).join(" ").trim() ||
    "LinkedIn account";
  return { id: data.sub, name, avatarUrl: data.picture ?? null };
}
