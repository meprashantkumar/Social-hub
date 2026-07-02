import type { Request, Response } from "express";
import * as service from "./workspace.service";

// --- Workspaces ---------------------------------------------------------

export const create = async (req: Request, res: Response): Promise<void> => {
  const workspace = await service.createWorkspace(req.userId!, req.body.name);
  res.status(201).json({ workspace });
};

export const list = async (req: Request, res: Response): Promise<void> => {
  const workspaces = await service.listWorkspacesForUser(req.userId!);
  res.json({ workspaces });
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
  const workspace = await service.getWorkspaceDetail(req.params.id);
  res.json({ workspace });
};

export const rename = async (req: Request, res: Response): Promise<void> => {
  const workspace = await service.renameWorkspace(req.params.id, req.body.name);
  res.json({ workspace });
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await service.deleteWorkspace(req.params.id);
  res.status(204).send();
};

// --- Invitations --------------------------------------------------------

export const invite = async (req: Request, res: Response): Promise<void> => {
  const invitation = await service.inviteMember(
    req.params.id,
    req.body.email,
    req.body.role,
    req.userId!
  );
  res.status(201).json({ invitation });
};

export const listInvitations = async (req: Request, res: Response): Promise<void> => {
  const invitations = await service.listPendingInvitations(req.params.id);
  res.json({ invitations });
};

export const revokeInvitation = async (req: Request, res: Response): Promise<void> => {
  await service.revokeInvitation(req.params.id, req.params.invitationId);
  res.status(204).send();
};

export const previewInvitation = async (req: Request, res: Response): Promise<void> => {
  const invitation = await service.getInvitationPreview(req.params.token);
  res.json({ invitation });
};

export const acceptInvitation = async (req: Request, res: Response): Promise<void> => {
  const workspace = await service.acceptInvitation(req.params.token, req.userId!, req.userEmail!);
  res.json({ workspace });
};

// --- Members ------------------------------------------------------------

export const changeMemberRole = async (req: Request, res: Response): Promise<void> => {
  const member = await service.changeMemberRole(req.params.id, req.params.userId, req.body.role);
  res.json({ member });
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
  await service.removeMember(req.params.id, req.params.userId, req.userId!, req.workspaceRole!);
  res.status(204).send();
};
