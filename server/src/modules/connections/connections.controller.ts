import { randomBytes } from "node:crypto";
import type { CookieOptions, Request, Response } from "express";
import { env, isProd } from "../../config/env";
import { AppError, badRequest } from "../../lib/errors";
import { signState, verifyState } from "../../lib/oauthState";
import * as service from "./connections.service";
import * as youtube from "./oauth/youtube.oauth";
import * as instagram from "./oauth/instagram.oauth";
import * as linkedin from "./oauth/linkedin.oauth";
import * as x from "./oauth/x.oauth";

const OAUTH_STATE_COOKIE = "oauth_state";
// Holds the PKCE code_verifier for providers that use it (X). Kept in an httpOnly
// cookie so it never travels to the provider — only the derived challenge does.
const OAUTH_PKCE_COOKIE = "oauth_pkce";
const STATE_COOKIE_PATH = "/api/connections/oauth";

// Per-platform OAuth providers: how to build the consent URL + finish the connect.
// getAuthUrl/complete receive the PKCE verifier; non-PKCE providers ignore it.
interface OAuthProvider {
  isConfigured: () => boolean;
  getAuthUrl: (state: string, pkceVerifier: string) => string;
  complete: (userId: string, workspaceId: string, code: string, pkceVerifier: string) => Promise<void>;
}

const PROVIDERS: Record<string, OAuthProvider> = {
  YOUTUBE: {
    isConfigured: youtube.isConfigured,
    getAuthUrl: youtube.getAuthUrl,
    complete: service.completeYoutubeConnection,
  },
  INSTAGRAM: {
    isConfigured: instagram.isConfigured,
    getAuthUrl: instagram.getAuthUrl,
    complete: service.completeInstagramConnection,
  },
  LINKEDIN: {
    isConfigured: linkedin.isConfigured,
    getAuthUrl: linkedin.getAuthUrl,
    complete: service.completeLinkedinConnection,
  },
  X: {
    isConfigured: x.isConfigured,
    getAuthUrl: x.getAuthUrl,
    complete: service.completeXConnection,
  },
};

// Short-lived cookie that binds the OAuth flow to the browser that started it.
const stateCookieOptions = (): CookieOptions => ({
  httpOnly: true,
  secure: env.COOKIE_SECURE || isProd,
  sameSite: "lax", // sent on the top-level GET redirect back from the provider
  path: STATE_COOKIE_PATH,
  maxAge: 10 * 60 * 1000,
});

export const list = async (req: Request, res: Response): Promise<void> => {
  const connections = await service.listConnections(req.workspaceId!);
  res.json({ connections });
};

/**
 * Returns the provider consent URL (called via authenticated XHR). The frontend
 * then navigates the browser to it. We don't redirect here because a top-level
 * redirect wouldn't carry the Bearer token.
 */
export const start = async (req: Request, res: Response): Promise<void> => {
  const platform = req.params.platform.toUpperCase();
  const provider = PROVIDERS[platform];
  if (!provider) {
    throw badRequest("That platform isn't supported yet", "PLATFORM_NOT_SUPPORTED");
  }
  if (!provider.isConfigured()) {
    throw new AppError(501, `${platform} OAuth is not configured on the server`, "OAUTH_NOT_CONFIGURED");
  }
  const nonce = randomBytes(16).toString("hex");
  // PKCE verifier for providers that use it (X); harmless for those that don't.
  const pkceVerifier = randomBytes(32).toString("base64url");
  const state = signState({
    userId: req.userId!,
    workspaceId: req.workspaceId!,
    platform,
    nonce,
  });
  res.cookie(OAUTH_STATE_COOKIE, nonce, stateCookieOptions());
  res.cookie(OAUTH_PKCE_COOKIE, pkceVerifier, stateCookieOptions());
  res.json({ url: provider.getAuthUrl(state, pkceVerifier) });
};

/**
 * Public OAuth redirect target. Trust is established via the signed `state`
 * (not a session), so no auth middleware runs here. Always redirects the browser
 * back to the app's connections page with a status.
 */
export const callback = async (req: Request, res: Response): Promise<void> => {
  const backTo = (params: Record<string, string>) =>
    res.redirect(`${env.CLIENT_ORIGIN}/connections?${new URLSearchParams(params).toString()}`);

  // Consume the browser-binding nonce cookie + PKCE verifier up front (single-use).
  const cookieNonce = req.cookies?.[OAUTH_STATE_COOKIE] as string | undefined;
  const pkceVerifier = (req.cookies?.[OAUTH_PKCE_COOKIE] as string | undefined) ?? "";
  res.clearCookie(OAUTH_STATE_COOKIE, { path: STATE_COOKIE_PATH });
  res.clearCookie(OAUTH_PKCE_COOKIE, { path: STATE_COOKIE_PATH });

  const { code, state, error } = req.query;

  if (typeof error === "string") return backTo({ status: "error", reason: error });
  if (typeof code !== "string" || typeof state !== "string") {
    return backTo({ status: "error", reason: "missing_code" });
  }

  let parsed;
  try {
    parsed = verifyState(state);
  } catch {
    return backTo({ status: "error", reason: "invalid_state" });
  }

  // CSRF: the flow must be finished by the same browser that started it — the
  // nonce in the signed state must match the one we set in the httpOnly cookie.
  if (!cookieNonce || cookieNonce !== parsed.nonce) {
    return backTo({ status: "error", reason: "invalid_state" });
  }
  // Only complete the platform the state was actually minted for, and it must
  // match the callback path we were hit on.
  const provider = PROVIDERS[parsed.platform];
  if (!provider || req.params.platform.toUpperCase() !== parsed.platform) {
    return backTo({ status: "error", reason: "unsupported_platform" });
  }

  try {
    await provider.complete(parsed.userId, parsed.workspaceId, code, pkceVerifier);
    return backTo({ status: "connected", platform: parsed.platform.toLowerCase() });
  } catch (err) {
    console.error(`[connections] ${parsed.platform} connect failed:`, err);
    const reason = err instanceof AppError && err.code ? err.code : "connect_failed";
    return backTo({ status: "error", reason });
  }
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await service.disconnect(req.params.id, req.userId!);
  res.status(204).send();
};
