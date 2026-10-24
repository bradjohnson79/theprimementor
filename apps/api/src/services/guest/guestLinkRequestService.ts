import { and, eq, gt } from "drizzle-orm";
import { guestOrderAccessTokens, type Database } from "@wisdom/db";

/**
 * Abuse protection for guest order-link emails (resend-links, order-access/issue, and the
 * checkout-time order-access email).
 *
 * - Per-address cooldown + hourly cap, backed by guest_order_access_tokens (one row per email
 *   sent), so it holds across API instances and restarts.
 * - Link requests (resend / issue) never create users, never mint links into real accounts,
 *   and always produce the same outward response, so they cannot be used to probe whether an
 *   email has an account or orders.
 */
export const GUEST_LINK_COOLDOWN_MS = 60_000;
export const GUEST_LINK_MAX_PER_HOUR = 5;
export const GUEST_LINK_WINDOW_MS = 60 * 60_000;
export const GUEST_LINK_GENERIC_MESSAGE = "If we found an order for that email, a fresh link is on its way.";

export type GuestLinkThrottleDecision =
  | { allowed: true }
  | { allowed: false; reason: "cooldown" | "hourly_cap" };

export function decideGuestLinkThrottle(recentIssuedAt: Date[], now: Date = new Date()): GuestLinkThrottleDecision {
  const inWindow = recentIssuedAt.filter((d) => now.getTime() - d.getTime() < GUEST_LINK_WINDOW_MS);
  if (inWindow.some((d) => now.getTime() - d.getTime() < GUEST_LINK_COOLDOWN_MS)) {
    return { allowed: false, reason: "cooldown" };
  }
  if (inWindow.length >= GUEST_LINK_MAX_PER_HOUR) {
    return { allowed: false, reason: "hourly_cap" };
  }
  return { allowed: true };
}

export async function getRecentGuestLinkIssues(db: Database, email: string, now: Date = new Date()): Promise<Date[]> {
  const rows = await db
    .select({ createdAt: guestOrderAccessTokens.created_at })
    .from(guestOrderAccessTokens)
    .where(and(
      eq(guestOrderAccessTokens.email, email.trim().toLowerCase()),
      eq(guestOrderAccessTokens.purpose, "order_page"),
      gt(guestOrderAccessTokens.created_at, new Date(now.getTime() - GUEST_LINK_WINDOW_MS)),
    ));
  return rows.map((r) => r.createdAt);
}

export type GuestLinkRequestOutcome =
  | "sent"
  | "honeypot"
  | "invalid_email"
  | "no_user"
  | "real_account"
  | "no_orders"
  | "throttled"
  | "error";

export interface GuestLinkRequestDeps {
  normalizeEmail(raw: unknown): string;
  findUser(email: string): Promise<{ userId: string; isRealAccount: boolean } | null>;
  hasOrders(userId: string): Promise<boolean>;
  recentIssues(email: string): Promise<Date[]>;
  send(userId: string, email: string): Promise<void>;
  now?: () => Date;
}

/** Never throws; the caller must return the same generic response for every outcome. */
export async function handleGuestLinkRequest(
  deps: GuestLinkRequestDeps,
  input: { email: unknown; honeypotTripped: boolean },
): Promise<GuestLinkRequestOutcome> {
  try {
    if (input.honeypotTripped) return "honeypot";
    let email: string;
    try {
      email = deps.normalizeEmail(input.email);
    } catch {
      return "invalid_email";
    }
    const user = await deps.findUser(email);
    if (!user) return "no_user";
    if (user.isRealAccount) return "real_account";
    if (!(await deps.hasOrders(user.userId))) return "no_orders";
    const decision = decideGuestLinkThrottle(await deps.recentIssues(email), deps.now ? deps.now() : new Date());
    if (!decision.allowed) return "throttled";
    await deps.send(user.userId, email);
    return "sent";
  } catch {
    return "error";
  }
}
