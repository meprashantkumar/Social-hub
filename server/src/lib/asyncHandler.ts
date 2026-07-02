import type { NextFunction, Request, Response } from "express";

/**
 * Wraps an async route handler so rejected promises are forwarded to Express's
 * error handler instead of crashing the process (Express 4 does not do this).
 */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
