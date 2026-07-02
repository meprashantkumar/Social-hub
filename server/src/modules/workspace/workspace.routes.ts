import { Router } from "express";
import { requireAuth } from "../../middleware/requireAuth";
import { validateBody } from "../../middleware/validate";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspaceAccess";
import { asyncHandler } from "../../lib/asyncHandler";
import * as ctrl from "./workspace.controller";
import { changeRoleSchema, createWorkspaceSchema, inviteSchema, renameWorkspaceSchema } from "./workspace.schemas";

// -------- /api/workspaces --------
export const workspaceRouter = Router();
workspaceRouter.use(requireAuth);

workspaceRouter.post("/", validateBody(createWorkspaceSchema), asyncHandler(ctrl.create));
workspaceRouter.get("/", asyncHandler(ctrl.list));

workspaceRouter.get("/:id", requireWorkspaceMember, asyncHandler(ctrl.getOne));
workspaceRouter.patch(
  "/:id",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  validateBody(renameWorkspaceSchema),
  asyncHandler(ctrl.rename)
);
workspaceRouter.delete(
  "/:id",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  asyncHandler(ctrl.remove)
);

// Invitations (owner-managed)
workspaceRouter.post(
  "/:id/invite",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  validateBody(inviteSchema),
  asyncHandler(ctrl.invite)
);
workspaceRouter.get(
  "/:id/invitations",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  asyncHandler(ctrl.listInvitations)
);
workspaceRouter.delete(
  "/:id/invitations/:invitationId",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  asyncHandler(ctrl.revokeInvitation)
);

// Members
workspaceRouter.patch(
  "/:id/members/:userId",
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER"),
  validateBody(changeRoleSchema),
  asyncHandler(ctrl.changeMemberRole)
);
// Any member may remove themselves (leave); owner may remove others.
workspaceRouter.delete(
  "/:id/members/:userId",
  requireWorkspaceMember,
  asyncHandler(ctrl.removeMember)
);

// -------- /api/invitations --------
export const invitationRouter = Router();
invitationRouter.get("/:token", asyncHandler(ctrl.previewInvitation));
invitationRouter.post("/:token/accept", requireAuth, asyncHandler(ctrl.acceptInvitation));
