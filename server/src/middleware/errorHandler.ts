import type { NextFunction, Request, Response } from "express";
import { isProd } from "../config/env";
import { AppError } from "../lib/errors";

export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: "Route not found", code: "ROUTE_NOT_FOUND" });
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code });
    return;
  }

  // Postgres "invalid text representation" — e.g. a malformed UUID/enum in a
  // route param. Treat as a bad request, not a server error.
  if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "22P02") {
    res.status(400).json({ error: "Invalid identifier format", code: "INVALID_ID" });
    return;
  }

  console.error("Unhandled error:", err);
  const message =
    isProd || !(err instanceof Error) ? "Internal server error" : err.message;
  res.status(500).json({ error: message, code: "INTERNAL_ERROR" });
};
