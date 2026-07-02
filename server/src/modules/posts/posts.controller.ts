import type { Request, Response } from "express";
import * as service from "./posts.service";

const STATUSES = new Set([
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
]);

const parseStatus = (raw: unknown): string | undefined =>
  typeof raw === "string" && STATUSES.has(raw) ? raw : undefined;

export const create = async (req: Request, res: Response): Promise<void> => {
  const post = await service.createPost(req.userId!, req.body);
  res.status(201).json({ post });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const posts = await service.listPosts(req.workspaceId!, parseStatus(req.query.status));
  res.json({ posts });
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
  const post = await service.getPost(req.params.id, req.userId!);
  res.json({ post });
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const post = await service.updatePost(req.params.id, req.userId!, req.body);
  res.json({ post });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await service.deletePost(req.params.id, req.userId!);
  res.status(204).send();
};

export const submit = async (req: Request, res: Response): Promise<void> => {
  const post = await service.submitForReview(req.params.id, req.userId!);
  res.json({ post });
};

export const approve = async (req: Request, res: Response): Promise<void> => {
  const post = await service.approvePost(req.params.id, req.userId!);
  res.json({ post });
};

export const requestChanges = async (req: Request, res: Response): Promise<void> => {
  const post = await service.requestChanges(req.params.id, req.userId!);
  res.json({ post });
};

export const publish = async (req: Request, res: Response): Promise<void> => {
  const post = await service.publishPost(req.params.id, req.userId!, req.body.visibility);
  res.json({ post });
};

export const schedule = async (req: Request, res: Response): Promise<void> => {
  const post = await service.schedulePost(
    req.params.id,
    req.userId!,
    new Date(req.body.scheduledFor),
    req.body.visibility
  );
  res.json({ post });
};

export const unschedule = async (req: Request, res: Response): Promise<void> => {
  const post = await service.unschedulePost(req.params.id, req.userId!);
  res.json({ post });
};
