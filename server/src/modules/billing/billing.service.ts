import { and, count, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  payments,
  posts,
  users,
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  type BillingPlan,
} from "../../db/schema";
import { env } from "../../config/env";
import { AppError, badRequest, notFound } from "../../lib/errors";
import { daysToMs, FREE_LIMITS, PLAN_LIST, PLANS } from "./billing.plans";
import * as razorpay from "./billing.razorpay";

const isActive = (proExpiresAt: Date | null | undefined): boolean =>
  !!proExpiresAt && proExpiresAt.getTime() > Date.now();

async function countRows(query: Promise<Array<{ n: number }>>): Promise<number> {
  const [row] = await query;
  return Number(row?.n ?? 0);
}

/** Is this user currently on Pro? */
export async function isUserPro(userId: string): Promise<boolean> {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { proExpiresAt: true },
  });
  return isActive(u?.proExpiresAt ?? null);
}

/** A workspace's limits are governed by its OWNER's plan. */
async function isWorkspaceOwnerPro(workspaceId: string): Promise<boolean> {
  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
    columns: { ownerId: true },
  });
  return ws ? isUserPro(ws.ownerId) : false;
}

// --- Limit enforcement (called from workspace/post services) --------------

export async function assertCanCreateWorkspace(userId: string): Promise<void> {
  if (await isUserPro(userId)) return;
  const owned = await countRows(
    db.select({ n: count() }).from(workspaces).where(eq(workspaces.ownerId, userId))
  );
  if (owned >= FREE_LIMITS.workspaces) {
    throw new AppError(
      402,
      `The Free plan is limited to ${FREE_LIMITS.workspaces} workspace. Upgrade to Pro to create more.`,
      "PLAN_LIMIT_WORKSPACES"
    );
  }
}

export async function assertCanInviteMember(workspaceId: string, email: string): Promise<void> {
  if (await isWorkspaceOwnerPro(workspaceId)) return;
  // Re-inviting an already-pending email is a refresh, not a new seat.
  const existing = await db.query.workspaceInvitations.findFirst({
    where: and(
      eq(workspaceInvitations.workspaceId, workspaceId),
      eq(workspaceInvitations.email, email),
      eq(workspaceInvitations.status, "PENDING")
    ),
  });
  if (existing) return;

  const members = await countRows(
    db.select({ n: count() }).from(workspaceMembers).where(eq(workspaceMembers.workspaceId, workspaceId))
  );
  const pending = await countRows(
    db
      .select({ n: count() })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.status, "PENDING")
        )
      )
  );
  if (members + pending >= FREE_LIMITS.members) {
    throw new AppError(
      402,
      `Free workspaces are limited to ${FREE_LIMITS.members} members. Upgrade to Pro to add more.`,
      "PLAN_LIMIT_MEMBERS"
    );
  }
}

export async function assertCanCreatePost(workspaceId: string): Promise<void> {
  if (await isWorkspaceOwnerPro(workspaceId)) return;
  const existing = await countRows(
    db.select({ n: count() }).from(posts).where(eq(posts.workspaceId, workspaceId))
  );
  if (existing >= FREE_LIMITS.posts) {
    throw new AppError(
      402,
      `Free workspaces are limited to ${FREE_LIMITS.posts} posts. Upgrade to Pro to create more.`,
      "PLAN_LIMIT_POSTS"
    );
  }
}

// --- Billing status + checkout --------------------------------------------

export async function getBillingStatus(userId: string) {
  const u = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { proExpiresAt: true },
  });
  const pro = isActive(u?.proExpiresAt ?? null);
  const workspacesOwned = await countRows(
    db.select({ n: count() }).from(workspaces).where(eq(workspaces.ownerId, userId))
  );
  return {
    plan: pro ? ("pro" as const) : ("free" as const),
    proExpiresAt: u?.proExpiresAt ?? null,
    limits: FREE_LIMITS,
    workspacesOwned,
    plans: PLAN_LIST.map((p) => ({
      id: p.id,
      label: p.label,
      priceLabel: p.priceLabel,
      amount: p.amount,
    })),
  };
}

/** Create a Razorpay order for the chosen plan and record it as pending. */
export async function createOrder(userId: string, planId: BillingPlan) {
  if (!razorpay.isConfigured()) {
    throw new AppError(501, "Payments are not configured on the server", "PAYMENTS_NOT_CONFIGURED");
  }
  const plan = PLANS[planId];
  if (!plan) throw badRequest("Unknown plan", "UNKNOWN_PLAN");

  const order = await razorpay.createOrder(plan.amount, `pro_${planId}_${Date.now().toString(36)}`, {
    userId,
    planId,
  });

  await db.insert(payments).values({
    userId,
    razorpayOrderId: order.id,
    plan: planId,
    amount: plan.amount,
    status: "created",
  });

  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: env.RAZORPAY_KEY_ID,
    plan: planId,
  };
}

/**
 * Verify a completed checkout and, on success, extend the user's Pro expiry by
 * the plan's duration. The plan is taken from OUR stored order (not the client),
 * so the granted period can't be tampered with.
 */
export async function verifyPayment(
  userId: string,
  input: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }
) {
  const payment = await db.query.payments.findFirst({
    where: eq(payments.razorpayOrderId, input.razorpayOrderId),
  });
  if (!payment || payment.userId !== userId) {
    throw notFound("Payment not found", "PAYMENT_NOT_FOUND");
  }
  if (payment.status === "paid") {
    return getBillingStatus(userId); // idempotent — already applied
  }

  const ok = razorpay.verifySignature(
    input.razorpayOrderId,
    input.razorpayPaymentId,
    input.razorpaySignature
  );
  if (!ok) {
    await db
      .update(payments)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    throw new AppError(400, "Payment verification failed", "PAYMENT_VERIFICATION_FAILED");
  }

  const plan = PLANS[payment.plan];
  const current = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { proExpiresAt: true },
  });
  // Stack renewals: extend from the later of "now" and the current expiry.
  const base = isActive(current?.proExpiresAt ?? null)
    ? current!.proExpiresAt!.getTime()
    : Date.now();
  const newExpiry = new Date(base + daysToMs(plan.days));

  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ razorpayPaymentId: input.razorpayPaymentId, status: "paid", updatedAt: new Date() })
      .where(eq(payments.id, payment.id));
    await tx
      .update(users)
      .set({ proExpiresAt: newExpiry, updatedAt: new Date() })
      .where(eq(users.id, userId));
  });

  return getBillingStatus(userId);
}
