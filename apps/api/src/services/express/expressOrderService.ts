import { createHmac, timingSafeEqual } from "node:crypto";
import type { ExpressServiceId } from "@wisdom/utils";
import { parseHolidayList } from "./businessDayDeadline.js";
import {
  confirmPaidExpressOrder,
  expressDownloadPath,
  notificationKey,
  planExpressReminderEmails,
  reviewExpressDeadlines,
  type ExpressOrderRecord,
  type NotificationRow,
} from "./expressFulfillment.js";
import { composeExpressEmail, EXPRESS_ADMIN_EMAIL } from "./expressEmail.js";
import type { PrivateRecordingStore } from "./privateRecordingStore.js";

export interface ExpressIntake {
  birthdate: string;
  guide: string;
  question: string;
  focusAreas: string[];
  healingContext: string;
  pastLifeInterest: string;
}

export interface StoredExpressOrder extends ExpressOrderRecord {
  intake: ExpressIntake;
  refundReview: boolean;
}

export interface StoredNotice extends NotificationRow {
  providerMessageId: string | null;
  lastError: string | null;
}

export interface ExpressRepository {
  get(id: string): Promise<StoredExpressOrder | null>;
  insert(order: StoredExpressOrder): Promise<boolean>;
  save(order: StoredExpressOrder): Promise<void>;
  list(): Promise<StoredExpressOrder[]>;
  getNotice(key: string): Promise<StoredNotice | null>;
  insertNotice(notice: StoredNotice): Promise<boolean>;
  saveNotice(notice: StoredNotice): Promise<void>;
  listNotices(orderId: string): Promise<StoredNotice[]>;
}

export function createMemoryExpressRepository(): ExpressRepository {
  const orders = new Map<string, StoredExpressOrder>();
  const notices = new Map<string, StoredNotice>();
  const copy = <T>(value: T): T => structuredClone(value);
  return {
    async get(id) {
      const order = orders.get(id);
      return order ? copy(order) : null;
    },
    async insert(order) {
      if (orders.has(order.id)) return false;
      orders.set(order.id, copy(order));
      return true;
    },
    async save(order) {
      orders.set(order.id, copy(order));
    },
    async list() {
      return [...orders.values()].map(copy);
    },
    async getNotice(key) {
      const notice = notices.get(key);
      return notice ? copy(notice) : null;
    },
    async insertNotice(notice) {
      if (notices.has(notice.key)) return false;
      notices.set(notice.key, copy(notice));
      return true;
    },
    async saveNotice(notice) {
      notices.set(notice.key, copy(notice));
    },
    async listNotices(orderId) {
      return [...notices.values()].filter((notice) => notice.entityId === orderId).map(copy);
    },
  };
}

export interface ExpressPaymentInput {
  id: string;
  serviceId: ExpressServiceId;
  customerName: string;
  customerEmail: string;
  amountCents: number;
  transcription: boolean;
  paidAt: Date;
  intake: ExpressIntake;
  adminEmail?: string;
}

export async function confirmExpressPayment(repo: ExpressRepository, input: ExpressPaymentInput) {
  const existing = await repo.get(input.id);
  if (existing) return { order: existing, duplicate: true as const };

  const draftOrders: ExpressOrderRecord[] = [];
  const draftNotices: NotificationRow[] = [];
  const confirmed = await confirmPaidExpressOrder({
    id: input.id,
    serviceId: input.serviceId,
    customerName: input.customerName,
    transcription: input.transcription,
    paidAt: input.paidAt,
    holidays: parseHolidayList(process.env.EXPRESS_HOLIDAYS),
    customerEmail: input.customerEmail,
    adminEmail: input.adminEmail ?? EXPRESS_ADMIN_EMAIL,
    orders: draftOrders,
    notices: draftNotices,
  });
  const stored: StoredExpressOrder = {
    ...confirmed.order,
    amountCents: input.amountCents,
    intake: input.intake,
    refundReview: false,
  };
  if (!await repo.insert(stored)) {
    const raced = await repo.get(input.id);
    if (!raced) throw new Error("Express order disappeared during confirmation");
    return { order: raced, duplicate: true as const };
  }
  for (const notice of draftNotices) {
    await repo.insertNotice({ ...notice, providerMessageId: null, lastError: null });
  }
  return { order: stored, duplicate: false as const };
}

export async function dispatchExpressNotice(
  repo: ExpressRepository,
  notice: StoredNotice,
  send: (notice: StoredNotice) => Promise<{ ok: boolean; messageId?: string; error?: string }>,
) {
  if (notice.status === "sent") return notice;
  const next = { ...notice, attempts: notice.attempts + 1 };
  const result = await send(next);
  if (result.ok) {
    next.status = "sent";
    next.providerMessageId = result.messageId ?? null;
    next.lastError = null;
  } else {
    next.status = "failed";
    next.lastError = result.error ?? "Email provider rejected the message";
  }
  await repo.saveNotice(next);
  return next;
}

export async function dispatchPendingExpressEmails(
  repo: ExpressRepository,
  orderId: string,
  send: (notice: StoredNotice) => Promise<{ ok: boolean; messageId?: string; error?: string }>,
) {
  const order = await repo.get(orderId);
  if (!order) throw new Error("Express order was not found");
  const pending = (await repo.listNotices(orderId)).filter((notice) => notice.status !== "sent");
  const sent: StoredNotice[] = [];
  for (const notice of pending) {
    const saved = await dispatchExpressNotice(repo, notice, send);
    sent.push(saved);
    if (saved.status === "sent" && saved.eventType === "express_customer_delivery") {
      order.fulfillmentStatus = "delivered";
      order.deliveredAt = new Date().toISOString();
      await repo.save(order);
    }
  }
  return { order: await repo.get(orderId), notices: sent };
}

export async function attachExpressRecording(input: {
  repo: ExpressRepository;
  store: PrivateRecordingStore;
  orderId: string;
  mp3?: Uint8Array | null;
  transcript?: Uint8Array | null;
}) {
  const order = await input.repo.get(input.orderId);
  if (!order) throw new Error("Express order was not found");
  if (input.mp3) {
    order.mp3Key = `express/${order.id}/reply.mp3`;
    await input.store.put(order.mp3Key, input.mp3);
  }
  if (input.transcript) {
    order.transcriptKey = `express/${order.id}/transcript.txt`;
    await input.store.put(order.transcriptKey, input.transcript);
  }
  if (order.mp3Key && (!order.transcription || order.transcriptKey) && order.fulfillmentStatus !== "delivered") {
    order.fulfillmentStatus = "ready";
  }
  await input.repo.save(order);
  return order;
}

export async function queueExpressDelivery(input: {
  repo: ExpressRepository;
  orderId: string;
  now?: Date;
}) {
  const order = await input.repo.get(input.orderId);
  if (!order) throw new Error("Express order was not found");
  if (!order.mp3Key) throw new Error("An MP3 is required before delivery");
  if (order.transcription && !order.transcriptKey) throw new Error("A transcript is required for this order");
  const expiresAt = (input.now ?? new Date()).getTime() + 7 * 24 * 60 * 60 * 1000;
  const mp3Url = expressDownloadPath(signExpressDownload(order.id, "mp3", expiresAt));
  const transcriptUrl = order.transcriptKey
    ? expressDownloadPath(signExpressDownload(order.id, "transcript", expiresAt))
    : null;
  const message = await composeExpressEmail("customer_delivery", {
    customerName: order.customerName,
    serviceName: order.serviceName,
    orderId: order.id,
    amountLabel: "",
    transcription: order.transcription,
    deadlineLabel: order.deliveryDate ?? "",
    paidAtLabel: order.paidAt ?? "",
    adminUrl: "",
    mp3Url,
    transcriptUrl,
  });
  const notice: StoredNotice = {
    key: notificationKey("express_customer_delivery", order.id, order.customerEmail),
    eventType: "express_customer_delivery",
    entityId: order.id,
    recipient: order.customerEmail,
    channel: "email",
    status: "pending",
    attempts: 0,
    subject: message.subject,
    body: message.text,
    source: "template",
    providerMessageId: null,
    lastError: null,
  };
  const existing = await input.repo.getNotice(notice.key);
  if (existing?.status === "sent") return { order, notice: existing, duplicate: true as const };
  if (!existing) await input.repo.insertNotice(notice);
  else await input.repo.saveNotice({ ...notice, attempts: existing.attempts, status: "pending" });
  return { order, notice, duplicate: false as const, mp3Url, transcriptUrl };
}

export function signExpressDownload(orderId: string, kind: "mp3" | "transcript", expiresMs: number, secret = downloadSecret()) {
  const payload = `${orderId}.${kind}.${expiresMs}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readExpressDownload(token: string, now = Date.now(), secret = downloadSecret()) {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [orderId, kind, expires, signature] = parts;
  if (!orderId || (kind !== "mp3" && kind !== "transcript") || !expires || !signature) return null;
  const expiresMs = Number(expires);
  if (!Number.isFinite(expiresMs) || expiresMs < now) return null;
  const expected = createHmac("sha256", secret).update(`${orderId}.${kind}.${expires}`).digest("base64url");
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  return { orderId, kind, expiresMs };
}

function downloadSecret() {
  return process.env.EXPRESS_DOWNLOAD_SECRET?.trim()
    || process.env.INTERNAL_API_SECRET?.trim()
    || "express-download-development-secret";
}

export async function runExpressReminderPass(repo: ExpressRepository, now: Date) {
  const orders = await repo.list();
  const review = reviewExpressDeadlines(orders, now);
  for (const item of review) {
    if (item.action !== "flag_refund_review") continue;
    const order = await repo.get(item.id);
    if (!order || order.refundReview) continue;
    order.refundReview = true;
    await repo.save(order);
  }
  const existing: NotificationRow[] = [];
  for (const order of orders) {
    existing.push(...await repo.listNotices(order.id));
  }
  const queued = await planExpressReminderEmails({
    orders,
    now,
    notices: existing,
    adminEmail: EXPRESS_ADMIN_EMAIL,
  });
  for (const notice of queued) {
    await repo.insertNotice({ ...notice, providerMessageId: null, lastError: null });
  }
  return { review, queued };
}

export async function loadExpressDownload(input: {
  repo: ExpressRepository;
  store: PrivateRecordingStore;
  token: string;
  now?: number;
}) {
  const parsed = readExpressDownload(input.token, input.now);
  if (!parsed) return null;
  const order = await input.repo.get(parsed.orderId);
  if (!order) return null;
  const key = parsed.kind === "mp3" ? order.mp3Key : order.transcriptKey;
  if (!key) return null;
  const bytes = await input.store.get(key);
  if (!bytes) return null;
  return { order, kind: parsed.kind, bytes };
}
