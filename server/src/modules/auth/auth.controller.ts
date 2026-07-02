import type { CookieOptions, Request, Response } from "express";
import { env, isProd } from "../../config/env";
import { notFound } from "../../lib/errors";
import * as authService from "./auth.service";

const REFRESH_COOKIE = "refreshToken";

/**
 * The refresh token lives in an httpOnly cookie scoped to /api/auth so it is not
 * readable by JS (XSS-resistant) and is only sent to the auth endpoints.
 */
const refreshCookieOptions = (expiresAt?: Date): CookieOptions => ({
  httpOnly: true,
  // SameSite=None cookies MUST also be Secure, per browsers.
  secure: env.COOKIE_SECURE || isProd || env.COOKIE_SAMESITE === "none",
  sameSite: env.COOKIE_SAMESITE,
  path: "/api/auth",
  ...(expiresAt ? { expires: expiresAt } : {}),
});

const contextFrom = (req: Request): authService.AuthContext => ({
  userAgent: req.headers["user-agent"],
  ip: req.ip,
});

const sendAuth = (res: Response, result: authService.AuthResult, status = 200): void => {
  res.cookie(REFRESH_COOKIE, result.refreshToken, refreshCookieOptions(result.refreshTokenExpiresAt));
  res.status(status).json({ user: result.user, accessToken: result.accessToken });
};

export const register = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.register(req.body, contextFrom(req));
  sendAuth(res, result, 201);
};

export const login = async (req: Request, res: Response): Promise<void> => {
  const result = await authService.login(req.body, contextFrom(req));
  sendAuth(res, result);
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_COOKIE] as string | undefined;
  const result = await authService.refresh(token, contextFrom(req));
  sendAuth(res, result);
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  await authService.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
  res.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
  res.status(204).send();
};

export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await authService.getUserById(req.userId!);
  if (!user) throw notFound("User not found", "USER_NOT_FOUND");
  res.json({ user });
};
