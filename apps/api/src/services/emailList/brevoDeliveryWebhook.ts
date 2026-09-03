import { createHmac, timingSafeEqual } from "node:crypto";
import { createHttpError } from "../booking/errors.js";
import { normalizeEmail } from "./emailNormalize.js";
import type { EmailListStore } from "./emailListStore.js";
import type { DeliveryEventKind } from "./emailHealthTypes.js";
import { applyDelivered, applyHealthOutcome, applySoftBounce } from "./emailHealthService.js";

const PROVIDER = "brevo";

export function mapBrevoEvent(event: string, reason = ""): DeliveryEventKind | null {
  const key = event.trim().toLowerCase();
  if (key === "delivered") return "delivered";
  if (key === "hardbounce" || key === "hard_bounce") return "hard_bounce";
  if (key === "softbounce" || key === "soft_bounce") return "soft_bounce";
  if (key === "blocked") {
    return /permanent|unknown user|user unknown|does not exist|no such user|mailbox unavailable|invalid mailbox/i.test(reason)
      ? "hard_bounce"
      : "blocked";
  }
  if (key === "spam" || key === "spamcomplaint") return "spam";
  if (key === "unsubscribed" || key === "unsubscribe") return "unsubscribed";
  return null;
}

export function verifyBrevoWebhookSecret(
  secret: string | undefined,
  headers: Record<string, string | string[] | undefined>,
  query: Record<string, unknown>,
  rawBody = "",
): boolean {
  if (!secret) return false;
  const headerCandidates = [
    headers["x-brevo-signature"],
    headers["x-webhook-secret"],
    headers["x-webhook-token"],
    headers.authorization,
  ];
  for (const value of headerCandidates) {
    const text = Array.isArray(value) ? value[0] : value;
    if (!text) continue;
    const token = text.startsWith("Bearer ") ? text.slice(7) : text;
    if (safeEqual(token, secret)) return true;
    if (rawBody && safeEqual(token, createHmac("sha256", secret).update(rawBody).digest("hex"))) {
      return true;
    }
  }
  const queryToken = typeof query.token === "string" ? query.token : typeof query.secret === "string" ? query.secret : "";
  return Boolean(queryToken && safeEqual(queryToken, secret));
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function firstString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function parseBrevoWebhookPayload(body: Record<string, unknown>) {
  const event = firstString(body.event || body.event_name || body.type);
  const email = firstString(body.email);
  const reason = firstString(body.reason || body["hard_bounce_reason"] || body.error);
  const eventId = firstString(body.id || body["message-id"] || body.messageId || body["event-id"]);
  return { event, email, reason, eventId };
}

export async function handleBrevoDeliveryEvent(
  store: EmailListStore,
  body: Record<string, unknown>,
) {
  const parsed = parseBrevoWebhookPayload(body);
  if (!parsed.email || !parsed.event) {
    throw createHttpError(400, "Brevo webhook requires event and email");
  }
  const kind = mapBrevoEvent(parsed.event, parsed.reason);
  if (!kind) {
    return { ignored: true, event: parsed.event };
  }
  const emailNormalized = normalizeEmail(parsed.email);
  const providerEventId = parsed.eventId
    ? `${parsed.event}:${parsed.eventId}:${emailNormalized}`
    : `${parsed.event}:${emailNormalized}:${firstString(body.date) || firstString(body.ts)}`;
  const inserted = await store.insertDeliveryEvent({
    provider: PROVIDER,
    provider_event_id: providerEventId,
    email_normalized: emailNormalized,
    kind,
  });
  if (!inserted.created) {
    return { duplicate: true, kind };
  }

  if (kind === "unsubscribed") {
    return { kind, purged: false };
  }

  const contact = await store.getContactByNormalized(emailNormalized);
  if (kind === "delivered") {
    if (contact) await applyDelivered(store, contact);
    return { kind, purged: false };
  }
  if (kind === "soft_bounce") {
    if (contact) await applySoftBounce(store, contact, parsed.reason || "Provider reported a soft bounce.");
    return { kind, purged: false };
  }
  if (kind === "spam") {
    if (contact) {
      await applyHealthOutcome(store, contact, {
        status: "risky",
        source: "brevo",
        reason: parsed.reason || "Provider reported a spam complaint.",
        definitive: false,
      });
    }
    return { kind, purged: false };
  }
  if (kind === "blocked") {
    if (contact) {
      await applyHealthOutcome(store, contact, {
        status: "blocked",
        source: "brevo",
        reason: parsed.reason || "Provider blocked the address.",
        definitive: false,
      });
    }
    return { kind, purged: false };
  }

  if (contact) {
    const result = await applyHealthOutcome(store, contact, {
      status: "hard_bounce",
      source: "brevo",
      reason: parsed.reason || "Provider reported a hard bounce.",
      definitive: true,
      providerEventId,
    });
    await notifyBrevoBlacklist(emailNormalized);
    return { kind, purged: result.purged, suppressed: result.suppressed };
  }

  await store.insertSuppression({
    email_normalized: emailNormalized,
    reason: "hard_bounce",
    source: "brevo",
    provider_event_id: providerEventId,
  });
  await notifyBrevoBlacklist(emailNormalized);
  return { kind, purged: false, suppressed: true };
}

export async function notifyBrevoBlacklist(email: string, env: NodeJS.ProcessEnv = process.env) {
  const apiKey = env.BREVO_API_KEY?.trim();
  if (!apiKey) return;
  try {
    await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: { "api-key": apiKey, "content-type": "application/json" },
      body: JSON.stringify({ email, emailBlacklisted: true, updateEnabled: true }),
    });
  } catch {
    // Optional adapter only. Do not fail webhook processing.
  }
}
