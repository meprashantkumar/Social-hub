import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { requireWorkspaceMember } from "../../middleware/workspaceAccess";
import * as ctrl from "./analytics.controller";

export const analyticsRouter = Router();

// Live analytics for a workspace's published posts (any member).
analyticsRouter.get("/", requireAuth, requireWorkspaceMember, asyncHandler(ctrl.overview));
