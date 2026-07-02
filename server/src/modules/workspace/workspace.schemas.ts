import { z } from "zod";

/** Roles that can be assigned via the API. OWNER is reserved for the creator. */
const assignableRole = z.enum(["EDITOR", "REVIEWER", "VIEWER"]);

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1, "Workspace name is required").max(80),
});

export const renameWorkspaceSchema = createWorkspaceSchema;

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email is required"),
  role: assignableRole.default("EDITOR"),
});

export const changeRoleSchema = z.object({
  role: assignableRole,
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type InviteInput = z.infer<typeof inviteSchema>;
export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;
