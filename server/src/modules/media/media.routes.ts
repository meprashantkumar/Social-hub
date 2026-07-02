import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import {
  requireWorkspaceMember,
  requireWorkspaceRole,
} from "../../middleware/workspaceAccess";
import * as ctrl from "./media.controller";

export const mediaRouter = Router();

// Sign a direct-to-Cloudinary upload for ?workspaceId= (owner/editor only —
// same people who compose posts).
mediaRouter.post(
  "/sign",
  requireAuth,
  requireWorkspaceMember,
  requireWorkspaceRole("OWNER", "EDITOR"),
  asyncHandler(ctrl.sign)
);
