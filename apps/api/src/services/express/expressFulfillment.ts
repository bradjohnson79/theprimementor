import {
  expressAmountCents,
  getExpressService,
  type ExpressNotifyPreference,
  type ExpressServiceId,
} from "@wisdom/utils";
import { EXPRESS_TIME_ZONE, nextBusinessDayDeadline } from "./businessDayDeadline.js";

export type ExpressPaymentStatus = "pending" | "paid" | "refunded";
export type ExpressFulfillmentStatus = "awaiting_fulfillment" | "in_progress" | "ready" | "delivered" | "refunded";
export type ExpressDisplayStatus =
  | "pending_payment"
  | ExpressFulfillmentStatus
  | "overdue";

export interface ExpressOrderRecord {
  id: string;
  serviceId: ExpressServiceId;
  serviceName: string;
  amountCents: number;
  transcription: boolean;
  paymentStatus: ExpressPaymentStatus;
  fulfillmentStatus: ExpressFulfillmentStatus;
  paidAt: string | null;
  timezone: typeof EXPRESS_TIME_ZONE;
  deliveryDate: string | null;
  deadlineAt: string | null;
  deliveredAt: string | null;
  notify: ExpressNotifyPreference;
  customerEmail: string;
  customerMobile: string | null;
}

export interface NotificationRow {
  key: string;
  eventType: string;
  entityId: string;
  recipient: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  body: string;
  source: "model" | "template";
}

export interface ExpressCopyFields {
  serviceName: string;
  deadlineLabel: string;
  fulfillmentStatus: string;
}

export function notificationKey(eventType: string, entityId: string, recipient: string) {
  return `${eventType}:${entityId}:${recipient}`;
}

export function enqueueNotification(rows: NotificationRow[], input: Omit<NotificationRow, "key" | "status" | "attempts">) {
  const key = notificationKey(input.eventType, input.entityId, input.recipient);
  const existing = rows.find((row) => row.key === key);
  if (existing) return { created: false, row: existing };
  const row: NotificationRow = { ...input, key, status: "pending", attempts: 0 };
  rows.push(row);
  return { created: true, row };
}

export function claimNotification(rows: NotificationRow[]) {
  const row = rows.find((item) => item.status === "pending" || item.status === "failed");
  if (!row) return null;
  row.attempts += 1;
  return row;
}

export async function composeExpressNotice(
  fields: ExpressCopyFields,
  model?: (fields: ExpressCopyFields) => Promise<string>,
) {
  const template = `Express order: ${fields.serviceName}. Deadline ${fields.deadlineLabel}. Status ${fields.fulfillmentStatus}.`;
  if (!model) return { text: template, source: "template" as const };
  try {
    const text = (await model(fields)).trim();
    if (!text) return { text: template, source: "template" as const };
    return { text, source: "model" as const };
  } catch {
    return { text: template, source: "template" as const };
  }
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
    if (order.fulfillmentStatus === "delivered" || order.paymentStatus === "refunded") {
      return { id: order.id, action: "skipped" as const };
    }
    const displayStatus = visibleFulfillmentStatus(order, now);
    if (displayStatus === "overdue") {
      return { id: order.id, action: "flag_refund_review" as const, displayStatus };
    }
    return { id: order.id, action: "none" as const, displayStatus };
  });
}

export interface ConfirmExpressOrderInput {
  id: string;
  serviceId: ExpressServiceId;
  transcription: boolean;
  paidAt: Date;
  holidays?: readonly string[];
  notify: ExpressNotifyPreference;
  customerEmail: string;
  customerMobile?: string | null;
  adminEmail: string;
  adminSms: string;
  orders: ExpressOrderRecord[];
  notices: NotificationRow[];
  model?: (fields: ExpressCopyFields) => Promise<string>;
}

export async function confirmPaidExpressOrder(input: ConfirmExpressOrderInput) {
  const existing = input.orders.find((order) => order.id === input.id);
  if (existing) return { order: existing, duplicate: true };

  const service = getExpressService(input.serviceId);
  if (!service) throw new Error("Unknown Express service");
  const deadline = nextBusinessDayDeadline(input.paidAt, input.holidays ?? []);
  const order: ExpressOrderRecord = {
    id: input.id,
    serviceId: service.id,
    serviceName: service.name,
    amountCents: expressAmountCents(service.id, input.transcription),
    transcription: input.transcription,
    paymentStatus: "paid",
    fulfillmentStatus: "awaiting_fulfillment",
    paidAt: input.paidAt.toISOString(),
    timezone: "America/Vancouver",
    deliveryDate: deadline.deliveryDate,
    deadlineAt: deadline.deadlineAt.toISOString(),
    deliveredAt: null,
    notify: input.notify,
    customerEmail: input.customerEmail,
    customerMobile: input.customerMobile ?? null,
  };
  input.orders.push(order);

  const notice = await composeExpressNotice({
    serviceName: order.serviceName,
    deadlineLabel: deadline.deliveryDate,
    fulfillmentStatus: order.fulfillmentStatus,
  }, input.model);

  enqueueNotification(input.notices, {
    eventType: "express_admin_email",
    entityId: order.id,
    recipient: input.adminEmail,
    body: notice.text,
    source: notice.source,
  });
  enqueueNotification(input.notices, {
    eventType: "express_admin_sms",
    entityId: order.id,
    recipient: input.adminSms,
    body: notice.text,
    source: notice.source,
  });
  if (input.notify === "email" || input.notify === "both") {
    enqueueNotification(input.notices, {
      eventType: "express_customer_email",
      entityId: order.id,
      recipient: input.customerEmail,
      body: notice.text,
      source: notice.source,
    });
  }
  if ((input.notify === "sms" || input.notify === "both") && input.customerMobile) {
    enqueueNotification(input.notices, {
      eventType: "express_customer_sms",
      entityId: order.id,
      recipient: input.customerMobile,
      body: notice.text,
      source: notice.source,
    });
  }

  return { order, duplicate: false };
}
