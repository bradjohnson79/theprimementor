import { randomBytes, createHmac, timingSafeEqual } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { guestOrderAccessTokens, type Database } from "@wisdom/db";
import { createHttpError } from "../booking/errors.js";

export type OrderAccessTokenPurpose = "order_page" | "email_verify_merge" | "order_intake";

const DEFAULT_ORDER_PAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, resend any time
const DEFAULT_MERGE_VERIFY_TTL_MS = 60 * 60 * 1000; // 1 hour, one-time use
/** Per-order intake links (thank-you page + post-payment email). Bound to ONE booking/report via metadata. */
const DEFAULT_ORDER_INTAKE_TTL_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

function getTokenSecret(): string {
  const secret = process.env.GUEST_ORDER_TOKEN_SECRET?.trim();
  if (!secret) {
    throw createHttpError(503, "Guest order links are not configured on this server.");
  }
  return secret;
}

function hashToken(rawToken: string): string {
  return createHmac("sha256", getTokenSecret()).update(rawToken).digest("hex");
}

function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface IssuedOrderAccessToken {
  token: string;
  expiresAt: Date;
  tokenRowId: string;
}

export async function issueOrderAccessToken(
  db: Database,
  input: {
    userId: string;
    email: string;
    purpose: OrderAccessTokenPurpose;
    ttlMs?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<IssuedOrderAccessToken> {
  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);
  const ttlMs = input.ttlMs ?? (
    input.purpose === "email_verify_merge"
      ? DEFAULT_MERGE_VERIFY_TTL_MS
      : input.purpose === "order_intake"
        ? DEFAULT_ORDER_INTAKE_TTL_MS
        : DEFAULT_ORDER_PAGE_TTL_MS
  );
  const expiresAt = new Date(Date.now() + ttlMs);

  const [row] = await db
    .insert(guestOrderAccessTokens)
    .values({
      user_id: input.userId,
      token_hash: tokenHash,
      purpose: input.purpose,
      email: input.email.trim().toLowerCase(),
      expires_at: expiresAt,
      metadata: input.metadata ?? null,
    })
    .returning();

  if (!row) {
    throw createHttpError(500, "Could not issue an access token.");
  }

  return { token: rawToken, expiresAt, tokenRowId: row.id };
}

export interface VerifiedOrderAccessToken {
  tokenRowId: string;
  userId: string;
  email: string;
  purpose: OrderAccessTokenPurpose;
  metadata: Record<string, unknown> | null;
}

/**
 * Verifies a raw token from an /order/:token or merge-confirm link. Looks up by the token's
 * own hash (constant-time compare is unnecessary beyond what the unique-index equality lookup
 * already gives us, since an attacker cannot search by the pre-image), checks expiry and
 * revocation, and bumps last_used_at. order_page tokens are reusable (resend any time);
 * email_verify_merge tokens are one-time and get revoked immediately after a successful verify
 * by the caller.
 */
export async function verifyOrderAccessToken(
  db: Database,
  rawToken: string,
  expectedPurpose?: OrderAccessTokenPurpose,
): Promise<VerifiedOrderAccessToken> {
  const trimmed = rawToken?.trim();
  if (!trimmed) {
    throw createHttpError(400, "A token is required.");
  }
  const tokenHash = hashToken(trimmed);

  const [row] = await db
    .select()
    .from(guestOrderAccessTokens)
    .where(and(
      eq(guestOrderAccessTokens.token_hash, tokenHash),
      isNull(guestOrderAccessTokens.revoked_at),
      gt(guestOrderAccessTokens.expires_at, new Date()),
    ))
    .limit(1);

  if (!row || (expectedPurpose && row.purpose !== expectedPurpose)) {
    throw createHttpError(404, "This link has expired or is no longer valid.");
  }

  await db
    .update(guestOrderAccessTokens)
    .set({ last_used_at: new Date() })
    .where(eq(guestOrderAccessTokens.id, row.id));

  return {
    tokenRowId: row.id,
    userId: row.user_id,
    email: row.email,
    purpose: row.purpose as OrderAccessTokenPurpose,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export async function revokeOrderAccessToken(db: Database, tokenRowId: string): Promise<void> {
  await db
    .update(guestOrderAccessTokens)
    .set({ revoked_at: new Date() })
    .where(eq(guestOrderAccessTokens.id, tokenRowId));
}

/** Constant-time helper retained for any future raw-token comparisons outside the DB lookup. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
