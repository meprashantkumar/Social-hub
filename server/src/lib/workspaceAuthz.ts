import { and, eq } from "drizzle-orm";
import { db } from "../db";
import { workspaceMembers, type WorkspaceRole } from "../db/schema";
import { forbidden } from "./errors";

/** The caller's role in a workspace, or null if they are not a member. */
export async function getMembershipRole(
  userId: string,
  workspaceId: string
): Promise<WorkspaceRole | null> {
  const membership = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ),
  });
  return membership?.role ?? null;
}

/**
 * Assert the caller is a member of the workspace with one of `roles`. Returns
 * their role. Use in services where the workspace is derived from a resource
 * (so the route :id isn't the workspace id and middleware can't gate it).
 */
export async function assertWorkspaceRole(
  userId: string,
  workspaceId: string,
  roles: WorkspaceRole[]
): Promise<WorkspaceRole> {
  const role = await getMembershipRole(userId, workspaceId);
  if (!role) throw forbidden("You are not a member of this workspace", "NOT_A_MEMBER");
  if (!roles.includes(role)) {
    throw forbidden("You don't have permission to do that", "INSUFFICIENT_ROLE");
  }
  return role;
}
