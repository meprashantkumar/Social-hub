import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspaceAccess";
import * as ctrl from "./connections.controller";

export const connectionsRouter = Router();

// List connections for a workspace (any member).
connectionsRouter.get(
  "/",
  requireAuth,
  requireWorkspaceMember,
  asyncHandler(ctrl.list)
);

// Begin an OAuth connect (owner/editor). Returns the consent URL as JSON.
connectionsRouter.get(
  "/oauth/:platform/start",
  requireAuth,
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER", "EDITOR"),
  asyncHandler(ctrl.start)
);

// OAuth redirect target — PUBLIC, trust comes from the signed state param.
connectionsRouter.get("/oauth/:platform/callback", asyncHandler(ctrl.callback));

// Disconnect (owner/editor; authorization checked in the service by workspace).
connectionsRouter.delete("/:id", requireAuth, asyncHandler(ctrl.remove));
