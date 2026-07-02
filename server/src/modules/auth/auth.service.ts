import bcrypt from "bcryptjs";
import { and, eq, gt, isNull } from "drizzle-orm";
import { env } from "../../config/env";
import { db } from "../../db";
import { refreshTokens, users, type User } from "../../db/schema";
import { conflict, unauthorized } from "../../lib/errors";
import type { LoginInput, RegisterInput } from "./auth.schemas";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./auth.tokens";

const SALT_ROUNDS = 12;

// A valid bcrypt hash compared against when the email is unknown, so that login
// takes roughly the same time whether or not the user exists (mitigates user
// enumeration via timing). Computed once at startup.
const DUMMY_HASH = bcrypt.hashSync("unused-placeholder-password", SALT_ROUNDS);

// Grace window during which re-presenting a just-rotated refresh token is treated
// as a benign client race (retry / multiple tabs / React StrictMode) instead of
// token theft — avoids spuriously logging the user out of every session.
const REFRESH_REUSE_GRACE_MS = 30_000;

export interface AuthContext {
  userAgent?: string;
  ip?: string;
}

export interface IssuedTokens {
  jti: string;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface AuthResult {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
}

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  createdAt: Date;
}

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  avatarUrl: u.avatarUrl,
  createdAt: u.createdAt,
});

/** Create a refresh-token row and sign both tokens for the given user. */
const issueTokens = async (user: User, ctx: AuthContext): Promise<IssuedTokens> => {
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  const [row] = await db
    .insert(refreshTokens)
    .values({
      userId: user.id,
      expiresAt,
      userAgent: ctx.userAgent,
      ip: ctx.ip,
    })
    .returning();

  return {
    jti: row.id,
    accessToken: signAccessToken({ sub: user.id, email: user.email }),
    refreshToken: signRefreshToken({ sub: user.id, jti: row.id }),
    refreshTokenExpiresAt: expiresAt,
  };
};

export const register = async (input: RegisterInput, ctx: AuthContext): Promise<AuthResult> => {
  const existing = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  if (existing) throw conflict("An account with this email already exists", "EMAIL_TAKEN");

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const [user] = await db
    .insert(users)
    .values({ email: input.email, password: passwordHash, name: input.name })
    .returning();

  const tokens = await issueTokens(user, ctx);
  return { user: toPublicUser(user), ...tokens };
};

export const login = async (input: LoginInput, ctx: AuthContext): Promise<AuthResult> => {
  const user = await db.query.users.findFirst({ where: eq(users.email, input.email) });
  // Compare against a dummy hash when the user is missing to reduce timing leaks,
  // then fail with the same generic message either way.
  const hash = user?.password ?? DUMMY_HASH;
  const ok = await bcrypt.compare(input.password, hash);
  if (!user || !ok) throw unauthorized("Invalid email or password", "INVALID_CREDENTIALS");

  const tokens = await issueTokens(user, ctx);
  return { user: toPublicUser(user), ...tokens };
};

export const refresh = async (
  token: string | undefined,
  ctx: AuthContext
): Promise<AuthResult> => {
  if (!token) throw unauthorized("Missing refresh token", "NO_REFRESH_TOKEN");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized("Invalid or expired refresh token", "INVALID_REFRESH_TOKEN");
  }

  const now = new Date();

  // Atomically CLAIM the token: this UPDATE only matches a row that is still
  // active and unexpired, and Postgres row-locks it so exactly ONE concurrent
  // refresh can win. This closes the read-check-then-revoke race entirely.
  const [claimed] = await db
    .update(refreshTokens)
    .set({ revokedAt: now })
    .where(
      and(
        eq(refreshTokens.id, payload.jti),
        eq(refreshTokens.userId, payload.sub),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, now)
      )
    )
    .returning();

  if (!claimed) {
    // We didn't win the claim — determine why by inspecting the row.
    const stored = await db.query.refreshTokens.findFirst({
      where: eq(refreshTokens.id, payload.jti),
    });

    if (!stored || stored.userId !== payload.sub) {
      throw unauthorized("Refresh token not recognized", "INVALID_REFRESH_TOKEN");
    }
    if (stored.expiresAt.getTime() <= now.getTime()) {
      throw unauthorized("Refresh token expired", "REFRESH_TOKEN_EXPIRED");
    }

    // The row is already revoked. If it was rotated very recently, this is almost
    // certainly a benign client race (retry / extra tab). The token itself is
    // already revoked so it grants nothing — reject just THIS request and let the
    // client use the winning response, WITHOUT nuking every session.
    if (stored.revokedAt && now.getTime() - stored.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
      throw unauthorized("Refresh token already rotated, please retry", "REFRESH_RACE");
    }

    // Reuse of an old, already-rotated token outside the grace window -> likely
    // theft. Revoke every active session for this user.
    await db
      .update(refreshTokens)
      .set({ revokedAt: now })
      .where(and(eq(refreshTokens.userId, stored.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized("Refresh token has been revoked", "REFRESH_TOKEN_REVOKED");
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, claimed.userId) });
  if (!user) throw unauthorized("User no longer exists", "USER_NOT_FOUND");

  // We own the rotation: issue the successor and link it to the claimed row.
  const tokens = await issueTokens(user, ctx);
  await db
    .update(refreshTokens)
    .set({ replacedById: tokens.jti })
    .where(eq(refreshTokens.id, claimed.id));

  return { user: toPublicUser(user), ...tokens };
};

export const logout = async (token: string | undefined): Promise<void> => {
  if (!token) return;
  try {
    const payload = verifyRefreshToken(token);
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.id, payload.jti), isNull(refreshTokens.revokedAt)));
  } catch {
    // Invalid/expired token on logout is a no-op.
  }
};

export const getUserById = async (userId: string): Promise<PublicUser | null> => {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  return user ? toPublicUser(user) : null;
};
