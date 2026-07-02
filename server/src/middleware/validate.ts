import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodSchema } from "zod";
import { badRequest } from "../lib/errors";

/**
 * Validates & normalizes req.body against a Zod schema, replacing it with the
 * parsed result so downstream handlers get typed, trimmed data.
 */
export const validateBody =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const message = formatZodError(result.error);
      return next(badRequest(message, "VALIDATION_ERROR"));
    }
    req.body = result.data;
    next();
  };

const formatZodError = (error: ZodError): string =>
  error.errors
    .map((e) => {
      const path = e.path.join(".");
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join("; ");
