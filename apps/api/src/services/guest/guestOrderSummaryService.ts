import { and, desc, eq, inArray } from "drizzle-orm";
import {
  bookings,
  bookingTypes,
  regenerationSubscriptions,
  reports,
  shopEntitlements,
  shopProducts,
  users,
  type Database,
} from "@wisdom/db";
import { hasActiveShopEntitlement } from "../shop/shopEntitlementService.js";

export interface GuestOrderSessionItem {
  kind: "session";
  bookingId: string;
  sessionType: string;
  bookingTypeName: string;
  status: string;
  startTimeUtc: string | null;
  timezone: string;
  joinUrl: string | null;
  /** Guest pay-first order whose intake form hasn't been submitted yet. */
  intakePending: boolean;
}

export interface GuestOrderReportItem {
  kind: "report";
  reportId: string;
  tier: string;
  status: string;
  title: string;
  fullMarkdown: string | null;
  intakePending: boolean;
}

export interface GuestOrderShopItem {
  kind: "shop";
  entitlementId: string;
  productName: string;
  slug: string;
  downloadUrl: string | null;
  downloadLabel: string | null;
}

export interface GuestOrderWebinarItem {
  kind: "webinar";
  bookingId: string;
  eventKey: string | null;
  status: string;
  startTimeUtc: string | null;
  joinUrl: string | null;
}

export interface GuestOrderSubscriptionItem {
  kind: "manifestation_monthly";
  status: string;
  accessState: string;
  hasStripeCustomer: boolean;
  /** Guest pay-first: the paid regeneration booking still waiting for its Services Intake Form. */
  intakePending: boolean;
  intakeBookingId: string | null;
  /** The optional $29 first-month add-on was included at checkout. */
  manifestationEnhancementSelected: boolean;
}

export type GuestOrderItem =
  | GuestOrderSessionItem
  | GuestOrderReportItem
  | GuestOrderShopItem
  | GuestOrderWebinarItem
  | GuestOrderSubscriptionItem;

export interface GuestOrderSummary {
  userId: string;
  email: string;
  isGuest: boolean;
  items: GuestOrderItem[];
}

const SESSION_TYPES = ["focus", "mentoring", "qa_session", "prime_body_healing", "email_session", "past_life_akashic"] as const;

export async function getGuestOrderSummary(db: Database, userId: string): Promise<GuestOrderSummary> {
  const [user] = await db
    .select({ id: users.id, email: users.email, is_guest: users.is_guest })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new Error(`User ${userId} not found for order summary.`);
  }

  const items: GuestOrderItem[] = [];
  let pendingRegenerationBookingId: string | null = null;

  const sessionRows = await db
    .select({
      id: bookings.id,
      sessionType: bookings.session_type,
      status: bookings.status,
      startTimeUtc: bookings.start_time_utc,
      timezone: bookings.timezone,
      joinUrl: bookings.join_url,
      eventKey: bookings.event_key,
      bookingTypeName: bookingTypes.name,
      intake: bookings.intake,
    })
    .from(bookings)
    .innerJoin(bookingTypes, eq(bookings.booking_type_id, bookingTypes.id))
    .where(eq(bookings.user_id, userId))
    .orderBy(desc(bookings.created_at));

  for (const row of sessionRows) {
    if (row.status !== "paid" && row.status !== "scheduled" && row.status !== "completed") {
      continue;
    }
    if (row.sessionType === "regeneration" && !pendingRegenerationBookingId && isIntakePending(row.intake)) {
      pendingRegenerationBookingId = row.id;
    }
    if (row.eventKey) {
      items.push({
        kind: "webinar",
        bookingId: row.id,
        eventKey: row.eventKey,
        status: row.status,
        startTimeUtc: row.startTimeUtc?.toISOString() ?? null,
        joinUrl: row.joinUrl,
      });
      continue;
    }
    if ((SESSION_TYPES as readonly string[]).includes(row.sessionType)) {
      items.push({
        kind: "session",
        bookingId: row.id,
        sessionType: row.sessionType,
        bookingTypeName: row.bookingTypeName,
        status: row.status,
        startTimeUtc: row.startTimeUtc?.toISOString() ?? null,
        timezone: row.timezone,
        joinUrl: row.joinUrl,
        intakePending: isIntakePending(row.intake),
      });
    }
  }

  const reportRows = await db
    .select({
      id: reports.id,
      tier: reports.interpretation_tier,
      memberStatus: reports.member_status,
      displayTitle: reports.display_title,
      fullMarkdown: reports.full_markdown,
      purchaseIntake: reports.purchase_intake,
    })
    .from(reports)
    .where(and(eq(reports.user_id, userId), inArray(reports.member_status, ["paid", "fulfilled"])))
    .orderBy(desc(reports.created_at));

  for (const row of reportRows) {
    items.push({
      kind: "report",
      reportId: row.id,
      tier: row.tier,
      status: row.memberStatus,
      title: row.displayTitle || row.tier,
      fullMarkdown: row.fullMarkdown,
      intakePending: isIntakePending(row.purchaseIntake),
    });
  }

  const shopRows = await db
    .select({
      entitlement: shopEntitlements,
      product: shopProducts,
    })
    .from(shopEntitlements)
    .innerJoin(shopProducts, eq(shopProducts.id, shopEntitlements.product_id))
    .where(eq(shopEntitlements.user_id, userId));

  for (const row of shopRows) {
    if (!hasActiveShopEntitlement({ purchasedAt: row.entitlement.purchased_at, revokedAt: row.entitlement.revoked_at })) {
      continue;
    }
    items.push({
      kind: "shop",
      entitlementId: row.entitlement.id,
      productName: row.product.name,
      slug: row.product.slug,
      downloadUrl: row.product.fulfillment_type === "external_download" ? row.product.fulfillment_download_url : null,
      downloadLabel: row.product.fulfillment_download_label,
    });
  }

  const [subscriptionRow] = await db
    .select({
      status: regenerationSubscriptions.status,
      accessState: regenerationSubscriptions.access_state,
      stripeCustomerId: regenerationSubscriptions.stripe_customer_id,
      metadata: regenerationSubscriptions.metadata,
    })
    .from(regenerationSubscriptions)
    .where(eq(regenerationSubscriptions.user_id, userId))
    .limit(1);

  if (subscriptionRow && subscriptionRow.status !== "inactive") {
    items.push({
      kind: "manifestation_monthly",
      status: subscriptionRow.status,
      accessState: subscriptionRow.accessState,
      hasStripeCustomer: Boolean(subscriptionRow.stripeCustomerId),
      intakePending: Boolean(pendingRegenerationBookingId),
      intakeBookingId: pendingRegenerationBookingId,
      manifestationEnhancementSelected: readManifestationEnhancementSelected(subscriptionRow.metadata),
    });
  }

  return {
    userId: user.id,
    email: user.email,
    isGuest: user.is_guest,
    items,
  };
}

export function summarizeForEmail(summary: GuestOrderSummary): string[] {
  return summary.items.map((item) => {
    switch (item.kind) {
      case "session":
        return `${item.bookingTypeName} — ${item.status === "scheduled" ? "scheduled" : "booked"}`;
      case "report":
        return `${item.title} report — ${item.status === "fulfilled" ? "ready to view" : "being prepared"}`;
      case "shop":
        return `${item.productName} — digital download`;
      case "webinar":
        return `Event registration — ${item.status}`;
      case "manifestation_monthly":
        return "Manifestation Monthly subscription";
      default:
        return "Order item";
    }
  });
}

function readManifestationEnhancementSelected(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return false;
  const enhancement = (metadata as Record<string, unknown>).manifestationEnhancement;
  return Boolean(enhancement && typeof enhancement === "object" && (enhancement as Record<string, unknown>).selected === true);
}

function isIntakePending(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).intakePending === true);
}
