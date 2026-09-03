export const HEALTH_STATUSES = [
  "unchecked",
  "checking",
  "deliverable",
  "likely_deliverable",
  "risky",
  "catch_all",
  "soft_bounce",
  "hard_bounce",
  "invalid",
  "blocked",
  "unknown",
] as const;

export type HealthStatus = (typeof HEALTH_STATUSES)[number];

export const SUPPRESSION_REASONS = [
  "hard_bounce",
  "invalid",
  "provider_permanent_rejection",
] as const;

export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

export const SUPPRESSION_SOURCES = ["verifier", "brevo", "manual"] as const;
export type SuppressionSource = (typeof SUPPRESSION_SOURCES)[number];

export const HEALTH_SOURCES = [
  "syntax",
  "dns",
  "mailbox",
  "brevo",
  "manual",
] as const;
export type HealthSource = (typeof HEALTH_SOURCES)[number];

export const HEALTH_JOB_SCOPES = ["ids", "unchecked", "stale", "all_active"] as const;
export type HealthJobScope = (typeof HEALTH_JOB_SCOPES)[number];

export const HEALTH_JOB_STATUSES = ["queued", "running", "completed", "failed"] as const;
export type HealthJobStatus = (typeof HEALTH_JOB_STATUSES)[number];

export const DELIVERY_EVENT_KINDS = [
  "delivered",
  "hard_bounce",
  "soft_bounce",
  "blocked",
  "spam",
  "unsubscribed",
] as const;
export type DeliveryEventKind = (typeof DELIVERY_EVENT_KINDS)[number];

export const PURGE_STATUSES = new Set<HealthStatus>(["hard_bounce", "invalid"]);

export const STALE_HEALTH_MS = 7 * 24 * 60 * 60 * 1000;
export const SOFT_BOUNCE_RISKY_THRESHOLD = 3;

export function isHealthStatus(value: string): value is HealthStatus {
  return (HEALTH_STATUSES as readonly string[]).includes(value);
}

export function isHealthJobScope(value: string): value is HealthJobScope {
  return (HEALTH_JOB_SCOPES as readonly string[]).includes(value);
}

export function shouldPurgeStatus(status: HealthStatus): boolean {
  return PURGE_STATUSES.has(status);
}
