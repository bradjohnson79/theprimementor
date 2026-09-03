import { createHttpError } from "../booking/errors.js";
import { isValidEmail, normalizeEmail } from "./emailNormalize.js";
import type { ContactRow, EmailListStore } from "./emailListStore.js";
import {
  SOFT_BOUNCE_RISKY_THRESHOLD,
  shouldPurgeStatus,
  type HealthSource,
  type HealthStatus,
  type SuppressionReason,
  type SuppressionSource,
} from "./emailHealthTypes.js";
import {
  inspectMailDomain,
  resolveMailboxVerifier,
  type DnsLookup,
  type EmailHealthVerifier,
} from "./emailHealthVerifier.js";
import { serializeContact } from "./contactService.js";
import { upsertSuppression } from "./emailSuppressionService.js";

export interface HealthCheckDeps {
  verifier?: EmailHealthVerifier;
  dns?: DnsLookup;
}

export interface HealthCheckResult {
  contact: ReturnType<typeof serializeContact> | null;
  email: string;
  previousStatus: HealthStatus;
  healthStatus: HealthStatus;
  healthSource: HealthSource;
  reason: string;
  purged: boolean;
  suppressed: boolean;
}

const DELIVERY_AUTHORITY = new Set(["brevo"]);

function suppressionReasonFor(status: HealthStatus): SuppressionReason {
  return status === "hard_bounce" ? "hard_bounce" : status === "blocked" ? "provider_permanent_rejection" : "invalid";
}

function canOverwriteDeliveryAuthority(current: ContactRow, nextSource: HealthSource): boolean {
  if (current.health_source !== "brevo") return true;
  return nextSource === "brevo";
}

export async function evaluateAddressHealth(
  email: string,
  deps: HealthCheckDeps = {},
): Promise<{ status: HealthStatus; source: HealthSource; reason: string; definitive: boolean }> {
  if (!isValidEmail(email)) {
    return { status: "invalid", source: "syntax", reason: "Invalid email address.", definitive: true };
  }
  const domain = normalizeEmail(email).split("@")[1] ?? "";
  const domainResult = await inspectMailDomain(domain, deps.dns);
  if (domainResult.outcome === "timeout" || domainResult.outcome === "error") {
    return { status: "unknown", source: "dns", reason: domainResult.reason, definitive: false };
  }
  if (domainResult.outcome === "no_mail") {
    return { status: "invalid", source: "dns", reason: domainResult.reason, definitive: true };
  }

  const verifier = deps.verifier ?? resolveMailboxVerifier();
  const mailbox = await verifier.checkMailbox(email);
  if (mailbox.status === "invalid") {
    return {
      status: mailbox.definitive ? "invalid" : "unknown",
      source: "mailbox",
      reason: mailbox.reason,
      definitive: mailbox.definitive,
    };
  }
  if (mailbox.status === "catch_all") {
    return { status: "catch_all", source: "mailbox", reason: mailbox.reason, definitive: false };
  }
  if (mailbox.status === "risky") {
    return { status: "risky", source: "mailbox", reason: mailbox.reason, definitive: false };
  }
  if (mailbox.status === "deliverable") {
    return { status: "deliverable", source: "mailbox", reason: mailbox.reason, definitive: false };
  }
  if (domainResult.outcome === "has_mx") {
    return {
      status: "likely_deliverable",
      source: "dns",
      reason: "Deliverability check passed. Mailbox existence was not confirmed.",
      definitive: false,
    };
  }
  return {
    status: "unknown",
    source: "dns",
    reason: "No current issue detected. Mailbox existence was not confirmed.",
    definitive: false,
  };
}

export async function applyHealthOutcome(
  store: EmailListStore,
  contact: ContactRow,
  outcome: {
    status: HealthStatus;
    source: HealthSource;
    reason: string;
    definitive?: boolean;
    createdByUserId?: string | null;
    providerEventId?: string | null;
  },
): Promise<HealthCheckResult> {
  const latest = await store.getContactById(contact.id);
  if (!latest) {
    return {
      contact: null,
      email: contact.email,
      previousStatus: contact.health_status,
      healthStatus: outcome.status,
      healthSource: outcome.source,
      reason: outcome.reason,
      purged: true,
      suppressed: Boolean(await store.getSuppressionByNormalized(contact.email_normalized)),
    };
  }
  const previousStatus = latest.health_status;
  if (!canOverwriteDeliveryAuthority(latest, outcome.source)) {
    await store.insertHealthCheck({
      contact_id: latest.id,
      email_normalized: latest.email_normalized,
      previous_status: previousStatus,
      new_status: latest.health_status,
      source: outcome.source,
      reason: "Kept provider delivery result over a weaker re-check.",
    });
    return {
      contact: serializeContact(latest),
      email: latest.email,
      previousStatus,
      healthStatus: latest.health_status,
      healthSource: (latest.health_source as HealthSource) ?? "brevo",
      reason: latest.health_reason ?? "Provider delivery result kept.",
      purged: false,
      suppressed: false,
    };
  }

  const checkedAt = new Date();
  const patch = {
    health_status: outcome.status,
    health_checked_at: checkedAt,
    health_source: outcome.source,
    health_reason: outcome.reason,
  };
  await store.updateContact(latest.id, patch);
  await store.insertHealthCheck({
    contact_id: latest.id,
    email_normalized: latest.email_normalized,
    previous_status: previousStatus,
    new_status: outcome.status,
    source: outcome.source,
    reason: outcome.reason,
  });

  const purge = shouldPurgeStatus(outcome.status) && (outcome.definitive !== false || outcome.source === "brevo");
  if (!purge) {
    const updated = await store.getContactById(latest.id);
    return {
      contact: updated ? serializeContact(updated) : serializeContact({ ...latest, ...patch }),
      email: latest.email,
      previousStatus,
      healthStatus: outcome.status,
      healthSource: outcome.source,
      reason: outcome.reason,
      purged: false,
      suppressed: false,
    };
  }

  const suppression = await upsertSuppression(store, {
    emailNormalized: latest.email_normalized,
    reason: suppressionReasonFor(outcome.status),
    source: (DELIVERY_AUTHORITY.has(outcome.source) ? "brevo" : "verifier") as SuppressionSource,
    providerEventId: outcome.providerEventId ?? null,
    createdByUserId: outcome.createdByUserId ?? null,
  });
  await store.deleteContact(latest.id);
  return {
    contact: null,
    email: latest.email,
    previousStatus,
    healthStatus: outcome.status,
    healthSource: outcome.source,
    reason: outcome.reason,
    purged: true,
    suppressed: Boolean(suppression),
  };
}

export async function checkContactHealth(
  store: EmailListStore,
  id: string,
  deps: HealthCheckDeps = {},
  createdByUserId?: string | null,
): Promise<HealthCheckResult> {
  const contact = await store.getContactById(id);
  if (!contact) throw createHttpError(404, "Contact not found");
  const outcome = await evaluateAddressHealth(contact.email, deps);
  return applyHealthOutcome(store, contact, {
    ...outcome,
    createdByUserId,
  });
}

export async function applySoftBounce(store: EmailListStore, contact: ContactRow, reason: string) {
  const softBounceCount = contact.soft_bounce_count + 1;
  const status: HealthStatus = softBounceCount >= SOFT_BOUNCE_RISKY_THRESHOLD ? "risky" : "soft_bounce";
  const updated = await store.updateContact(contact.id, {
    health_status: status,
    health_checked_at: new Date(),
    health_source: "brevo",
    health_reason: reason,
    last_bounce_at: new Date(),
    last_soft_bounce_at: new Date(),
    bounce_count: contact.bounce_count + 1,
    soft_bounce_count: softBounceCount,
  });
  await store.insertHealthCheck({
    contact_id: contact.id,
    email_normalized: contact.email_normalized,
    previous_status: contact.health_status,
    new_status: status,
    source: "brevo",
    reason,
  });
  return updated ?? contact;
}

export async function applyDelivered(store: EmailListStore, contact: ContactRow, reason = "Provider reported delivery.") {
  const updated = await store.updateContact(contact.id, {
    health_status: "deliverable",
    health_checked_at: new Date(),
    health_source: "brevo",
    health_reason: reason,
  });
  await store.insertHealthCheck({
    contact_id: contact.id,
    email_normalized: contact.email_normalized,
    previous_status: contact.health_status,
    new_status: "deliverable",
    source: "brevo",
    reason,
  });
  return updated ?? contact;
}

export function serializeHealthJob(row: {
  id: string;
  scope: string;
  status: string;
  total: number;
  completed: number;
  counts: Record<string, number | undefined>;
  error: string | null;
}) {
  return {
    id: row.id,
    scope: row.scope,
    status: row.status,
    total: row.total,
    completed: row.completed,
    counts: row.counts,
    error: row.error,
    progressLabel: row.total > 0 ? `Checking ${row.completed} / ${row.total}` : "Checking…",
  };
}
