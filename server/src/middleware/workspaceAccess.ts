import type { NextFunction, Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { workspaceMembers, type WorkspaceRole } from "../db/schema";
import { asyncHandler } from "../lib/asyncHandler";
import { badRequest, forbidden, unauthorized } from "../lib/errors";

/**
 * Confirms the caller is a member of the workspace named by the `:id` route
 * param, and attaches their role to the request. Must run after requireAuth.
 */
export const requireWorkspaceMember = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) return next(unauthorized());
    // Route param (:id) for /workspaces/:id, or ?workspaceId= for scoped
    // collections like /connections.
    const workspaceId =
      req.params.id ??
      (typeof req.query.workspaceId === "string" ? req.query.workspaceId : undefined);
    if (!workspaceId) return next(badRequest("workspaceId is required", "WORKSPACE_ID_REQUIRED"));

    const membership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, req.userId)
      ),
    });
    if (!membership) {
      return next(forbidden("You are not a member of this workspace", "NOT_A_MEMBER"));
    }

    req.workspaceId = workspaceId;
    req.workspaceRole = membership.role;
    next();
  }
);

/** Gate an action behind one or more workspace roles. Run after requireWorkspaceMember. */
export const requireWorkspaceRole =
  (...roles: WorkspaceRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.workspaceRole || !roles.includes(req.workspaceRole)) {
      return next(forbidden("You don't have permission to do that", "INSUFFICIENT_ROLE"));
    }
    next();
  };
