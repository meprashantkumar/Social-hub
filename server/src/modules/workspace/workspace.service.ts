import { randomBytes } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  type WorkspaceRole,
} from "../../db/schema";
import { badRequest, conflict, forbidden, notFound } from "../../lib/errors";

const INVITE_TTL_DAYS = 7;
const newToken = () => randomBytes(24).toString("hex");
const inviteExpiry = () => new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

/** Create a workspace and make the creator its OWNER, atomically. */
export const createWorkspace = async (userId: string, name: string) => {
  const created = await db.transaction(async (tx) => {
    const [ws] = await tx.insert(workspaces).values({ name, ownerId: userId }).returning();
    await tx.insert(workspaceMembers).values({ workspaceId: ws.id, userId, role: "OWNER" });
    return ws;
  });
  return getWorkspaceDetail(created.id);
};

/** Workspaces the user belongs to, with their role in each. */
export const listWorkspacesForUser = async (userId: string) => {
  return db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      ownerId: workspaces.ownerId,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.createdAt));
};

export const getWorkspaceDetail = async (workspaceId: string) => {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    with: {
      members: {
        with: {
          user: { columns: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });
  if (!ws) throw notFound("Workspace not found", "WORKSPACE_NOT_FOUND");

  return {
    id: ws.id,
    name: ws.name,
    ownerId: ws.ownerId,
    createdAt: ws.createdAt,
    members: ws.members
      .slice()
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((m) => ({ userId: m.userId, role: m.role, joinedAt: m.createdAt, user: m.user })),
  };
};

export const renameWorkspace = async (workspaceId: string, name: string) => {
  const [ws] = await db
    .update(workspaces)
    .set({ name, updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning();
  if (!ws) throw notFound("Workspace not found", "WORKSPACE_NOT_FOUND");
  return getWorkspaceDetail(ws.id);
};

export const deleteWorkspace = async (workspaceId: string) => {
  // Members & invitations cascade via FK onDelete.
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
};

// --- Invitations --------------------------------------------------------

export const inviteMember = async (
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedById: string
) => {
  const existingUser = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existingUser) {
    const alreadyMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, existingUser.id)
      ),
    });
    if (alreadyMember) throw conflict("That person is already a member", "ALREADY_MEMBER");
  }

  const pending = await db.query.workspaceInvitations.findFirst({
    where: and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      eq(workspaceInvitations.email, email),
      eq(workspaceInvitations.status, "PENDING")
    ),
  });

  if (pending) {
    // Refresh the existing pending invite instead of stacking duplicates — but
    // only if it's still PENDING (it may have been accepted/revoked concurrently).
    const [updated] = await db
      .update(workspaceInvitations)
      .set({ role, token: newToken(), expiresAt: inviteExpiry(), invitedById })
      .where(
        and(
          eq(workspaceInvitations.id, pending.id),
          eq(workspaceInvitations.status, "PENDING")
        )
      )
      .returning();
    if (updated) return updated;
    // Otherwise it was consumed between our read and write — fall through to a fresh invite.
  }

  const [invite] = await db
    .insert(workspaceInvitations)
    .values({ workspaceId, email, role, token: newToken(), invitedById, expiresAt: inviteExpiry() })
    .returning();
  return invite;
};

export const listPendingInvitations = async (workspaceId: string) => {
  return db.query.workspaceInvitations.findMany({
    where: and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      eq(workspaceInvitations.status, "PENDING")
    ),
    orderBy: (t, { desc: d }) => d(t.createdAt),
  });
};

export const revokeInvitation = async (workspaceId: string, invitationId: string) => {
  const invite = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.id, invitationId),
  });
  if (!invite || invite.workspaceId !== workspaceId) {
    throw notFound("Invitation not found", "INVITE_NOT_FOUND");
  }
  if (invite.status !== "PENDING") {
    throw badRequest("Only pending invitations can be revoked", "INVITE_NOT_PENDING");
  }
  await db
    .update(workspaceInvitations)
    .set({ status: "REVOKED" })
    .where(eq(workspaceInvitations.id, invitationId));
};

export const getInvitationPreview = async (token: string) => {
  const invite = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.token, token),
    with: {
      workspace: { columns: { id: true, name: true } },
    },
  });
  if (!invite) throw notFound("Invitation not found", "INVITE_NOT_FOUND");

  const expired = invite.status === "PENDING" && invite.expiresAt.getTime() <= Date.now();
  // Public endpoint (token holder may be unauthenticated) — return only what the
  // accept screen needs; do NOT leak the invitee email or inviter identity.
  return {
    role: invite.role,
    status: expired ? "EXPIRED" : invite.status,
    workspace: invite.workspace,
    expiresAt: invite.expiresAt,
  };
};

export const acceptInvitation = async (token: string, userId: string, userEmail: string) => {
  const invite = await db.query.workspaceInvitations.findFirst({
    where: eq(workspaceInvitations.token, token),
  });
  if (!invite) throw notFound("Invitation not found", "INVITE_NOT_FOUND");
  if (invite.status !== "PENDING") {
    throw badRequest("This invitation is no longer valid", "INVITE_NOT_PENDING");
  }
  if (invite.expiresAt.getTime() <= Date.now()) {
    await db
      .update(workspaceInvitations)
      .set({ status: "EXPIRED" })
      .where(eq(workspaceInvitations.id, invite.id));
    throw badRequest("This invitation has expired", "INVITE_EXPIRED");
  }
  if (invite.email !== userEmail.toLowerCase()) {
    throw forbidden("This invitation was sent to a different email", "INVITE_EMAIL_MISMATCH");
  }

  await db.transaction(async (tx) => {
    // Atomically claim the invite: only one concurrent accept can flip PENDING
    // -> ACCEPTED, so double-clicks / retries can't both proceed.
    const [claimed] = await tx
      .update(workspaceInvitations)
      .set({ status: "ACCEPTED", acceptedAt: new Date() })
      .where(
        and(
          eq(workspaceInvitations.id, invite.id),
          eq(workspaceInvitations.status, "PENDING")
        )
      )
      .returning();
    if (!claimed) {
      throw badRequest("This invitation is no longer valid", "INVITE_NOT_PENDING");
    }

    // Idempotent membership insert — the unique index is the source of truth,
    // so a concurrent/duplicate accept is a harmless no-op instead of a 500.
    await tx
      .insert(workspaceMembers)
      .values({ workspaceId: invite.workspaceId, userId, role: invite.role })
      .onConflictDoNothing({
        target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      });
  });

  return getWorkspaceDetail(invite.workspaceId);
};

// --- Members ------------------------------------------------------------

export const changeMemberRole = async (
  workspaceId: string,
  targetUserId: string,
  role: WorkspaceRole
) => {
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId)
    ),
  });
  if (!member) throw notFound("Member not found", "MEMBER_NOT_FOUND");
  if (member.role === "OWNER") {
    throw forbidden("The workspace owner's role can't be changed", "CANNOT_CHANGE_OWNER");
  }

  const [updated] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(eq(workspaceMembers.id, member.id))
    .returning();
  return updated;
};

export const removeMember = async (
  workspaceId: string,
  targetUserId: string,
  actingUserId: string,
  actingRole: WorkspaceRole
) => {
  const member = await db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId)
    ),
  });
  if (!member) throw notFound("Member not found", "MEMBER_NOT_FOUND");
  if (member.role === "OWNER") {
    throw forbidden("The workspace owner can't be removed", "CANNOT_REMOVE_OWNER");
  }

  const isSelf = targetUserId === actingUserId;
  if (!isSelf && actingRole !== "OWNER") {
    throw forbidden("Only the owner can remove other members", "INSUFFICIENT_ROLE");
  }

  await db.delete(workspaceMembers).where(eq(workspaceMembers.id, member.id));
};
