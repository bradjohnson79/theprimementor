import { Resolver } from "node:dns/promises";
import { isValidEmail, normalizeEmail } from "./emailNormalize.js";
import type { HealthStatus } from "./emailHealthTypes.js";

export interface MailboxCheckResult {
  status: Extract<HealthStatus, "deliverable" | "invalid" | "catch_all" | "unknown" | "risky">;
  reason: string;
  definitive: boolean;
}

export interface EmailHealthVerifier {
  checkMailbox(email: string): Promise<MailboxCheckResult>;
}

export interface DnsLookup {
  resolveMx(domain: string): Promise<Array<{ exchange: string; priority: number }>>;
  resolve4(domain: string): Promise<string[]>;
  resolve6(domain: string): Promise<string[]>;
}

export type DomainMailOutcome = "has_mx" | "has_a" | "no_mail" | "timeout" | "error";

export interface DomainMailResult {
  outcome: DomainMailOutcome;
  reason: string;
}

const DNS_TIMEOUT_MS = 5_000;
const MAILBOX_TIMEOUT_MS = 8_000;

export function createNodeDnsLookup(): DnsLookup {
  const resolver = new Resolver();
  return {
    resolveMx: (domain) => resolver.resolveMx(domain),
    resolve4: (domain) => resolver.resolve4(domain),
    resolve6: (domain) => resolver.resolve6(domain),
  };
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(label)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function errorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code ?? "")
    : "";
}

function isNotFound(error: unknown): boolean {
  const code = errorCode(error);
  return code === "ENOTFOUND" || code === "ENODATA" || code === "ENXIO";
}

function isTimeout(error: unknown): boolean {
  if (error instanceof Error && (error.message === "DNS_TIMEOUT" || error.message === "MAILBOX_TIMEOUT")) {
    return true;
  }
  const code = errorCode(error);
  return code === "ETIMEOUT" || code === "UND_ERR_CONNECT_TIMEOUT";
}

async function lookupOrEmpty(
  work: Promise<string[]>,
  timeoutMs: number,
): Promise<{ records: string[]; timeout: boolean; error: boolean }> {
  try {
    return { records: await withTimeout(work, timeoutMs, "DNS_TIMEOUT"), timeout: false, error: false };
  } catch (error) {
    if (isTimeout(error)) return { records: [], timeout: true, error: false };
    if (isNotFound(error)) return { records: [], timeout: false, error: false };
    return { records: [], timeout: false, error: true };
  }
}

export async function inspectMailDomain(
  domain: string,
  lookup: DnsLookup = createNodeDnsLookup(),
  timeoutMs = DNS_TIMEOUT_MS,
): Promise<DomainMailResult> {
  try {
    const mx = await withTimeout(lookup.resolveMx(domain), timeoutMs, "DNS_TIMEOUT");
    if (mx.length > 0) {
      return { outcome: "has_mx", reason: "Domain publishes mail exchangers." };
    }
  } catch (error) {
    if (isTimeout(error)) {
      return { outcome: "timeout", reason: "DNS lookup timed out." };
    }
    if (!isNotFound(error)) {
      return { outcome: "error", reason: "DNS lookup failed." };
    }
  }

  const [ipv4, ipv6] = await Promise.all([
    lookupOrEmpty(lookup.resolve4(domain), timeoutMs),
    lookupOrEmpty(lookup.resolve6(domain), timeoutMs),
  ]);
  if (ipv4.timeout || ipv6.timeout) {
    return { outcome: "timeout", reason: "DNS lookup timed out." };
  }
  if (ipv4.error || ipv6.error) {
    return { outcome: "error", reason: "DNS lookup failed." };
  }
  if (ipv4.records.length > 0 || ipv6.records.length > 0) {
    return { outcome: "has_a", reason: "Domain has no MX records but still resolves." };
  }
  return { outcome: "no_mail", reason: "Domain has no mail service." };
}

export function createUnknownMailboxVerifier(): EmailHealthVerifier {
  return {
    async checkMailbox() {
      return {
        status: "unknown",
        reason: "Mailbox existence was not checked.",
        definitive: false,
      };
    },
  };
}

function mapReacherReachable(value: unknown): MailboxCheckResult {
  const reachable = typeof value === "string" ? value.toLowerCase() : "";
  if (reachable === "invalid" || reachable === "undeliverable") {
    return {
      status: "invalid",
      reason: "Mailbox verifier reported the address as undeliverable.",
      definitive: true,
    };
  }
  if (reachable === "safe" || reachable === "deliverable") {
    return {
      status: "deliverable",
      reason: "Mailbox verifier confirmed the address.",
      definitive: false,
    };
  }
  if (reachable === "risky") {
    return { status: "risky", reason: "Mailbox verifier marked the address as risky.", definitive: false };
  }
  return { status: "unknown", reason: "Mailbox verifier did not confirm the mailbox.", definitive: false };
}

export function mapMailboxAdapterPayload(payload: unknown): MailboxCheckResult {
  if (!payload || typeof payload !== "object") {
    return { status: "unknown", reason: "Mailbox verifier returned an empty response.", definitive: false };
  }
  const body = payload as Record<string, unknown>;
  const smtp = (body.smtp && typeof body.smtp === "object") ? body.smtp as Record<string, unknown> : {};
  if (smtp.is_catch_all === true || body.is_catch_all === true || body.catch_all === true) {
    return {
      status: "catch_all",
      reason: "The domain accepts mail broadly, so mailbox existence could not be confirmed.",
      definitive: false,
    };
  }
  const smtpError = typeof smtp.error === "string" ? smtp.error : "";
  const isReachable = body.is_reachable ?? body.status ?? body.result;
  const mapped = mapReacherReachable(isReachable);
  if (mapped.status === "invalid") {
    const definitive = /user unknown|mailbox unavailable|does not exist|no such user|undeliverable|invalid mailbox/i.test(
      `${smtpError} ${typeof body.reason === "string" ? body.reason : ""}`,
    ) || smtp.is_deliverable === false;
    return {
      ...mapped,
      reason: smtpError || mapped.reason,
      definitive,
    };
  }
  if (typeof body.reason === "string" && body.reason.trim()) {
    return { ...mapped, reason: body.reason.trim() };
  }
  return mapped;
}

export function createHttpMailboxVerifier(url: string, fetchImpl: typeof fetch = fetch): EmailHealthVerifier {
  return {
    async checkMailbox(email) {
      const normalized = normalizeEmail(email);
      if (!isValidEmail(normalized)) {
        return { status: "invalid", reason: "Invalid email address.", definitive: true };
      }
      try {
        const response = await withTimeout(
          fetchImpl(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ to_email: normalized }),
          }),
          MAILBOX_TIMEOUT_MS,
          "MAILBOX_TIMEOUT",
        );
        if (!response.ok) {
          return { status: "unknown", reason: "Mailbox verifier is unavailable.", definitive: false };
        }
        const payload = await response.json() as unknown;
        return mapMailboxAdapterPayload(payload);
      } catch (error) {
        if (isTimeout(error)) {
          return { status: "unknown", reason: "Mailbox verifier timed out.", definitive: false };
        }
        return { status: "unknown", reason: "Mailbox verifier is unavailable.", definitive: false };
      }
    },
  };
}

export function resolveMailboxVerifier(
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): EmailHealthVerifier {
  const url = env.EMAIL_HEALTH_VERIFIER_URL?.trim();
  if (!url) return createUnknownMailboxVerifier();
  return createHttpMailboxVerifier(url, fetchImpl);
}
