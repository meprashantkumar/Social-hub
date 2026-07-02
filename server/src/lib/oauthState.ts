import jwt from "jsonwebtoken";
import { env } from "../config/env";

/**
 * The OAuth `state` param does double duty: CSRF protection AND carrying which
 * user/workspace initiated the flow (the callback has no auth header). It's a
 * short-lived signed JWT so the public callback can trust it.
 */
export interface OAuthState {
  userId: string;
  workspaceId: string;
  platform: string;
  /** Per-flow random value mirrored in an httpOnly cookie to bind the flow to the browser (CSRF). */
  nonce: string;
}

const STATE_TTL_SECONDS = 600; // 10 minutes

export const signState = (state: OAuthState): string =>
  jwt.sign(state, env.OAUTH_STATE_SECRET, { expiresIn: STATE_TTL_SECONDS });

export const verifyState = (token: string): OAuthState =>
  jwt.verify(token, env.OAUTH_STATE_SECRET, { algorithms: ["HS256"] }) as unknown as OAuthState;
