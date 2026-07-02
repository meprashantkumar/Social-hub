import type { NextFunction, Request, Response } from "express";
import { unauthorized } from "../lib/errors";
import { verifyAccessToken } from "../modules/auth/auth.tokens";

/**
 * Verifies the Bearer access token and attaches the user id/email to the request.
 */
export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(unauthorized("Missing or invalid Authorization header", "NO_ACCESS_TOKEN"));
  }

  const token = header.slice("Bearer ".length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    next(unauthorized("Invalid or expired access token", "INVALID_ACCESS_TOKEN"));
  }
};
