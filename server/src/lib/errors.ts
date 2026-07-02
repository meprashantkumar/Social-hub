/**
 * Operational errors that map to an HTTP status. The error handler renders these
 * as JSON; anything that is NOT an AppError is treated as an unexpected 500.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, code?: string) => new AppError(400, message, code);
export const unauthorized = (message = "Unauthorized", code?: string) =>
  new AppError(401, message, code);
export const forbidden = (message = "Forbidden", code?: string) => new AppError(403, message, code);
export const notFound = (message = "Not found", code?: string) => new AppError(404, message, code);
export const conflict = (message: string, code?: string) => new AppError(409, message, code);
