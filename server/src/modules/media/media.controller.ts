import type { Request, Response } from "express";
import * as service from "./media.service";

/**
 * Returns a short-lived signed payload the browser uses to upload one file
 * directly to Cloudinary. Gated to workspace owners/editors by the route.
 */
export const sign = async (req: Request, res: Response): Promise<void> => {
  const signature = service.signUpload(req.workspaceId!);
  res.json(signature);
};

/** Signed payload for the signed-in user's own avatar upload (no workspace). */
export const signAvatar = async (req: Request, res: Response): Promise<void> => {
  const signature = service.signAvatarUpload(req.userId!);
  res.json(signature);
};
