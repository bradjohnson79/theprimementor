import { formatExpressPrice, expressAmountCents, expressSessionQuantity, getExpressService, type ExpressServiceId } from "@wisdom/utils";
import { EXPRESS_TIME_ZONE, nextBusinessDayDeadline, vancouverDateKey } from "./businessDayDeadline.js";
import {
  composeExpressEmail,
  expressAdminOrderUrl,
  type ExpressEmailFields,
  type ExpressEmailKind,
} from "./expressEmail.js";
import { createMemoryRecordingStore, type PrivateRecordingStore } from "./privateRecordingStore.js";

export type ExpressPaymentStatus = "pending" | "paid" | "refunded";
export type ExpressFulfillmentStatus = "awaiting_fulfillment" | "in_progress" | "ready" | "delivered" | "refunded";
export type ExpressDisplayStatus = "pending_payment" | ExpressFulfillmentStatus | "overdue";
export type ExpressReminderSlot = "morning" | "afternoon" | "overdue";

export interface ExpressOrderRecord {
  id: string;
  serviceId: ExpressServiceId;
  serviceName: string;
  customerName: string;
  amountCents: number;
  transcription: boolean;
  /** Ask Brad / Adronis may be 1–3. Other Express services stay at 1. */
  quantity?: number;
  paymentStatus: ExpressPaymentStatus;
  fulfillmentStatus: ExpressFulfillmentStatus;
  paidAt: string | null;
  timezone: typeof EXPRESS_TIME_ZONE;
  deliveryDate: string | null;
  deadlineAt: string | null;
  deliveredAt: string | null;
  customerEmail: string;
  mp3Key: string | null;
  transcriptKey: string | null;
  /** A sent Delay email makes the order non-refundable, including when it is late. */
  delayNotified?: boolean;
}

export interface NotificationRow {
  key: string;
  eventType: string;
  entityId: string;
  recipient: string;
  channel: "email";
  status: "pending" | "sent" | "failed";
  attempts: number;
  subject: string;
  body: string;
  source: "model" | "template";
}

export function notificationKey(eventType: string, entityId: string, recipient: string) {
  return `${eventType}:${entityId}:${recipient}`;
}

export function enqueueNotification(rows: NotificationRow[], input: Omit<NotificationRow, "key" | "status" | "attempts" | "channel">) {
  const key = notificationKey(input.eventType, input.entityId, input.recipient);
  const existing = rows.find((row) => row.key === key);
  if (existing) return { created: false, row: existing };
  const row: NotificationRow = { ...input, key, channel: "email", status: "pending", attempts: 0 };
  rows.push(row);
  return { created: true, row };
}

export function claimNotification(rows: NotificationRow[]) {
  const row = rows.find((item) => item.status === "pending" || item.status === "failed");
  if (!row) return null;
  row.attempts += 1;
  return row;
}

export function visibleFulfillmentStatus(order: ExpressOrderRecord, now: Date): ExpressDisplayStatus {
  if (order.paymentStatus === "refunded" || order.fulfillmentStatus === "refunded") return "refunded";
  if (order.paymentStatus !== "paid") return "pending_payment";
  if (order.fulfillmentStatus === "delivered") return "delivered";
  if (order.deadlineAt && now.getTime() > Date.parse(order.deadlineAt)) return "overdue";
  return order.fulfillmentStatus;
}

export function reviewExpressDeadlines(orders: ExpressOrderRecord[], now: Date) {
  return orders.map((order) => {
    if (order.fulfillmentStatus === "delivered" || order.paymentStatus === "refunded" || order.delayNotified) {
      return { id: order.id, action: "skipped" as const };
    }
    const displayStatus = visibleFulfillmentStatus(order, now);
    if (displayStatus === "overdue") return { id: order.id, action: "flag_refund_review" as const, displayStatus };
    return { id: order.id, action: "none" as const, displayStatus };
  });
}

function vancouverHour(instant: Date) {
  const hour = new Intl.DateTimeFormat("en-CA", {
    timeZone: EXPRESS_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(instant);
  return Number(hour);
}

export function expressReminderSlot(order: ExpressOrderRecord, now: Date): ExpressReminderSlot | null {
  if (order.fulfillmentStatus === "delivered" || order.paymentStatus !== "paid" || !order.deliveryDate || !order.deadlineAt) return null;
  if (now.getTime() > Date.parse(order.deadlineAt)) return "overdue";
  if (vancouverDateKey(now) !== order.deliveryDate) return null;
  return vancouverHour(now) < 12 ? "morning" : "afternoon";
}

function emailFields(order: ExpressOrderRecord, extra: Partial<ExpressEmailFields> = {}): ExpressEmailFields {
  return {
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    serviceName: order.serviceName,
    orderId: order.id,
    amountLabel: formatExpressPrice(order.amountCents),
    transcription: order.transcription,
    quantity: order.quantity ?? 1,
    deadlineLabel: order.deliveryDate ? `${order.deliveryDate} at 11:59 PM Pacific` : "",
    paidAtLabel: order.paidAt ?? "",
    adminUrl: expressAdminOrderUrl(order.id),
    ...extra,
  };
}

async function queueEmail(
  rows: NotificationRow[],
  order: ExpressOrderRecord,
  kind: ExpressEmailKind,
  recipient: string,
  fields: ExpressEmailFields,
) {
  const message = await composeExpressEmail(kind, fields);
  return enqueueNotification(rows, {
    eventType: `express_${kind}`,
    entityId: order.id,
    recipient,
    subject: message.subject,
    body: message.text,
    source: message.source,
  });
}

export interface ConfirmExpressOrderInput {
  id: string;
  serviceId: ExpressServiceId;
  customerName: string;
  transcription: boolean;
  quantity?: number;
  paidAt: Date;
  holidays?: readonly string[];
  customerEmail: string;
  adminEmail: string;
  intake?: {
    birthdate?: string;
    guide?: string;
    question?: string;
    focusAreas?: string[];
    healingContext?: string;
    pastLifeInterest?: string;
  };
  orders: ExpressOrderRecord[];
  notices: NotificationRow[];
}

export async function confirmPaidExpressOrder(input: ConfirmExpressOrderInput) {
  const existing = input.orders.find((order) => order.id === input.id);
  if (existing) return { order: existing, duplicate: true };

  const service = getExpressService(input.serviceId);
  if (!service) throw new Error("Unknown Express service");
  const quantity = expressSessionQuantity(service.id, input.quantity);
  if (!quantity) throw new Error("Choose a quantity from 1 to 3.");
  const deadline = nextBusinessDayDeadline(input.paidAt, input.holidays ?? []);
  const order: ExpressOrderRecord = {
    id: input.id,
    serviceId: service.id,
    serviceName: service.name,
    customerName: input.customerName,
    amountCents: expressAmountCents(service.id, input.transcription, quantity),
    transcription: input.transcription,
    quantity,
    paymentStatus: "paid",
    fulfillmentStatus: "awaiting_fulfillment",
    paidAt: input.paidAt.toISOString(),
    timezone: "America/Vancouver",
    deliveryDate: deadline.deliveryDate,
    deadlineAt: deadline.deadlineAt.toISOString(),
    deliveredAt: null,
    customerEmail: input.customerEmail,
    mp3Key: null,
    transcriptKey: null,
  };
  input.orders.push(order);
  const fields = emailFields(order);
  const intake = input.intake;
  await queueEmail(input.notices, order, "customer_confirmation", order.customerEmail, fields);
  await queueEmail(input.notices, order, "admin_purchase", input.adminEmail, emailFields(order, {
    birthdate: intake?.birthdate,
    guide: intake?.guide,
    question: intake?.question,
    focusAreas: intake?.focusAreas?.filter(Boolean).join(", "),
    healingContext: intake?.healingContext,
    pastLifeInterest: intake?.pastLifeInterest,
  }));
  return { order, duplicate: false };
}

export async function planExpressReminderEmails(input: {
  orders: ExpressOrderRecord[];
  now: Date;
  notices: NotificationRow[];
  adminEmail: string;
}) {
  const queued: NotificationRow[] = [];
  for (const order of input.orders) {
    const slot = expressReminderSlot(order, input.now);
    if (!slot) continue;
    const kind: ExpressEmailKind = slot === "morning"
      ? "admin_reminder_morning"
      : slot === "afternoon"
        ? "admin_reminder_afternoon"
        : "admin_overdue";
    const result = await queueEmail(input.notices, order, kind, input.adminEmail, emailFields(order));
    if (result.created) queued.push(result.row);
  }
  return queued;
}

export function expressDownloadToken(orderId: string, kind: "mp3" | "transcript", expiresAt: Date) {
  return `${orderId}.${kind}.${expiresAt.getTime()}`;
}

export function expressDownloadPath(token: string) {
  return `/api/express/downloads/${token}`;
}

export function expressDownloadUrl(token: string, origin = process.env.PUBLIC_API_URL?.trim() || "https://api.theprimementor.com") {
  return `${origin.replace(/\/$/, "")}${expressDownloadPath(token)}`;
}

export async function prepareExpressDelivery(input: {
  order: ExpressOrderRecord;
  store?: PrivateRecordingStore;
  mp3: Uint8Array;
  transcript?: Uint8Array | null;
  notices: NotificationRow[];
  now?: Date;
}) {
  if (input.order.transcription && !input.transcript) throw new Error("A transcript is required for this order");
  const store = input.store ?? createMemoryRecordingStore();
  const mp3Key = `express/${input.order.id}/reply.mp3`;
  await store.put(mp3Key, input.mp3);
  let transcriptKey: string | null = null;
  if (input.transcript) {
    transcriptKey = `express/${input.order.id}/transcript.txt`;
    await store.put(transcriptKey, input.transcript);
  }
  input.order.mp3Key = mp3Key;
  input.order.transcriptKey = transcriptKey;
  input.order.fulfillmentStatus = "ready";
  const expiresAt = new Date((input.now ?? new Date()).getTime() + 7 * 24 * 60 * 60 * 1000);
  const mp3Url = expressDownloadPath(expressDownloadToken(input.order.id, "mp3", expiresAt));
  const transcriptUrl = transcriptKey ? expressDownloadPath(expressDownloadToken(input.order.id, "transcript", expiresAt)) : null;
  const queued = await queueEmail(
    input.notices,
    input.order,
    "customer_delivery",
    input.order.customerEmail,
    emailFields(input.order, { mp3Url, transcriptUrl }),
  );
  return { order: input.order, notice: queued.row, store };
}

export function recordDeliveryAttempt(order: ExpressOrderRecord, notice: NotificationRow, result: "sent" | "failed", sentAt: Date) {
  notice.attempts += 1;
  if (result === "failed") {
    notice.status = "failed";
    return order;
  }
  notice.status = "sent";
  order.fulfillmentStatus = "delivered";
  order.deliveredAt = sentAt.toISOString();
  return order;
}
