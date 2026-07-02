import { Router } from "express";
import { asyncHandler } from "../../lib/asyncHandler";
import { requireAuth } from "../../middleware/requireAuth";
import { validateBody } from "../../middleware/validate";
import { requireWorkspaceMember } from "../../middleware/workspaceAccess";
import * as ctrl from "./posts.controller";
import {
  createPostSchema,
  publishPostSchema,
  schedulePostSchema,
  updatePostSchema,
} from "./posts.schemas";

export const postsRouter = Router();
postsRouter.use(requireAuth);

// workspaceId comes from the body (create) or ?workspaceId= (list); per-resource
// routes derive the workspace from the post and authorize in the service.
postsRouter.post("/", validateBody(createPostSchema), asyncHandler(ctrl.create));
postsRouter.get("/", requireWorkspaceMember, asyncHandler(ctrl.list));

postsRouter.get("/:id", asyncHandler(ctrl.getOne));
postsRouter.patch("/:id", validateBody(updatePostSchema), asyncHandler(ctrl.update));
postsRouter.delete("/:id", asyncHandler(ctrl.remove));

// Review workflow
postsRouter.post("/:id/submit", asyncHandler(ctrl.submit));
postsRouter.post("/:id/approve", asyncHandler(ctrl.approve));
postsRouter.post("/:id/request-changes", asyncHandler(ctrl.requestChanges));

// Publish now (APPROVED|FAILED -> PUBLISHING -> PUBLISHED/FAILED)
postsRouter.post("/:id/publish", validateBody(publishPostSchema), asyncHandler(ctrl.publish));

// Scheduling (APPROVED <-> SCHEDULED; the worker auto-publishes at the due time)
postsRouter.post("/:id/schedule", validateBody(schedulePostSchema), asyncHandler(ctrl.schedule));
postsRouter.post("/:id/unschedule", asyncHandler(ctrl.unschedule));
