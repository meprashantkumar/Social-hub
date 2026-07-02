import type { Request, Response } from "express";
import * as service from "./analytics.service";

export const overview = async (req: Request, res: Response): Promise<void> => {
  const analytics = await service.getWorkspaceAnalytics(req.workspaceId!);
  res.json(analytics);
};
