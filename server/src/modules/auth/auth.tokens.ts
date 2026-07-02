import jwt from "jsonwebtoken";
import { env } from "../../config/env";

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  jti: string; // refresh_tokens row id
}

export const signAccessToken = (payload: AccessTokenPayload): string =>
  jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL_SECONDS });

export const verifyAccessToken = (token: string): AccessTokenPayload =>
  jwt.verify(token, env.JWT_ACCESS_SECRET, {
    algorithms: ["HS256"],
  }) as unknown as AccessTokenPayload;

export const signRefreshToken = (payload: RefreshTokenPayload): string =>
  jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
  });

export const verifyRefreshToken = (token: string): RefreshTokenPayload =>
  jwt.verify(token, env.JWT_REFRESH_SECRET, {
    algorithms: ["HS256"],
  }) as unknown as RefreshTokenPayload;
