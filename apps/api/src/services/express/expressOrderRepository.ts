import { eq } from "drizzle-orm";
import { expressNotifications, expressOrders, type Database } from "@wisdom/db";
import type { ExpressServiceId } from "@wisdom/utils";
import type { ExpressIntake, ExpressRepository, StoredExpressOrder, StoredNotice } from "./expressOrderService.js";
import type { ExpressFulfillmentStatus, ExpressPaymentStatus } from "./expressFulfillment.js";
import { EXPRESS_TIME_ZONE } from "./businessDayDeadline.js";

function asIntake(value: unknown): ExpressIntake {
  const record = value && typeof value === "object" ? value as Partial<ExpressIntake> : {};
  return {
    birthdate: typeof record.birthdate === "string" ? record.birthdate : "",
    guide: typeof record.guide === "string" ? record.guide : "",
    question: typeof record.question === "string" ? record.question : "",
    focusAreas: Array.isArray(record.focusAreas) ? record.focusAreas.filter((item): item is string => typeof item === "string") : [],
    healingContext: typeof record.healingContext === "string" ? record.healingContext : "",
    pastLifeInterest: typeof record.pastLifeInterest === "string" ? record.pastLifeInterest : "",
  };
}

function toOrder(row: typeof expressOrders.$inferSelect): StoredExpressOrder {
  return {
    id: row.id,
    serviceId: row.service_id as ExpressServiceId,
    serviceName: row.service_name,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    amountCents: row.amount_cents,
    transcription: row.transcription,
    paymentStatus: row.payment_status as ExpressPaymentStatus,
    fulfillmentStatus: row.fulfillment_status as ExpressFulfillmentStatus,
    paidAt: row.paid_at.toISOString(),
    timezone: EXPRESS_TIME_ZONE,
    deliveryDate: row.delivery_date,
    deadlineAt: row.deadline_at.toISOString(),
    deliveredAt: row.delivered_at?.toISOString() ?? null,
    mp3Key: row.mp3_key,
    transcriptKey: row.transcript_key,
    intake: asIntake(row.intake),
    refundReview: row.refund_review,
  };
}

function toNotice(row: typeof expressNotifications.$inferSelect): StoredNotice {
  return {
    key: row.dedupe_key,
    eventType: row.event_type,
    entityId: row.order_id,
    recipient: row.recipient,
    channel: "email",
    status: row.status as StoredNotice["status"],
    attempts: row.attempts,
    subject: row.subject,
    body: row.body,
    source: "template",
    providerMessageId: row.provider_message_id,
    lastError: row.last_error,
  };
}

export function createPostgresExpressRepository(db: Database): ExpressRepository {
  return {
    async get(id) {
      const [row] = await db.select().from(expressOrders).where(eq(expressOrders.id, id)).limit(1);
      return row ? toOrder(row) : null;
    },
    async insert(order) {
      const inserted = await db.insert(expressOrders).values({
        id: order.id,
        service_id: order.serviceId,
        service_name: order.serviceName,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        amount_cents: order.amountCents,
        transcription: order.transcription,
        payment_status: order.paymentStatus,
        fulfillment_status: order.fulfillmentStatus,
        paid_at: new Date(order.paidAt ?? Date.now()),
        timezone: order.timezone,
        delivery_date: order.deliveryDate ?? "",
        deadline_at: new Date(order.deadlineAt ?? Date.now()),
        delivered_at: order.deliveredAt ? new Date(order.deliveredAt) : null,
        intake: order.intake,
        mp3_key: order.mp3Key,
        transcript_key: order.transcriptKey,
        refund_review: order.refundReview,
      }).onConflictDoNothing().returning({ id: expressOrders.id });
      return inserted.length > 0;
    },
    async save(order) {
      await db.update(expressOrders).set({
        fulfillment_status: order.fulfillmentStatus,
        delivered_at: order.deliveredAt ? new Date(order.deliveredAt) : null,
        mp3_key: order.mp3Key,
        transcript_key: order.transcriptKey,
        refund_review: order.refundReview,
        payment_status: order.paymentStatus,
        updated_at: new Date(),
      }).where(eq(expressOrders.id, order.id));
    },
    async list() {
      const rows = await db.select().from(expressOrders);
      return rows.map(toOrder);
    },
    async getNotice(key) {
      const [row] = await db.select().from(expressNotifications).where(eq(expressNotifications.dedupe_key, key)).limit(1);
      return row ? toNotice(row) : null;
    },
    async insertNotice(notice) {
      const inserted = await db.insert(expressNotifications).values({
        dedupe_key: notice.key,
        order_id: notice.entityId,
        event_type: notice.eventType,
        recipient: notice.recipient,
        subject: notice.subject,
        body: notice.body,
        status: notice.status,
        attempts: notice.attempts,
        provider_message_id: notice.providerMessageId,
        last_error: notice.lastError,
      }).onConflictDoNothing().returning({ id: expressNotifications.id });
      return inserted.length > 0;
    },
    async saveNotice(notice) {
      await db.update(expressNotifications).set({
        status: notice.status,
        attempts: notice.attempts,
        provider_message_id: notice.providerMessageId,
        last_error: notice.lastError,
        updated_at: new Date(),
      }).where(eq(expressNotifications.dedupe_key, notice.key));
    },
    async listNotices(orderId) {
      const rows = await db.select().from(expressNotifications).where(eq(expressNotifications.order_id, orderId));
      return rows.map(toNotice);
    },
  };
}
