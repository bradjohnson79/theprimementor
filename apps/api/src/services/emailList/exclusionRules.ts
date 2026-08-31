import { isValidEmail, normalizeEmail } from "./emailNormalize.js";

export type ExclusionKind = "email" | "domain";

export interface ExclusionRule {
  kind: ExclusionKind;
  value: string;
  pattern: string;
}

const DOMAIN_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

export function parseExclusionInput(raw: string): ExclusionRule {
  const trimmed = raw.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    throw new Error("Enter an email or a domain like @facebook.com");
  }

  if (trimmed.startsWith("@")) {
    const domain = trimmed.slice(1).trim().toLowerCase();
    if (!DOMAIN_RE.test(domain)) {
      throw new Error("Enter a valid domain such as @facebook.com");
    }
    return { kind: "domain", value: domain, pattern: `@${domain}` };
  }

  if (trimmed.includes("@")) {
    if (!isValidEmail(trimmed)) {
      throw new Error("Enter a valid email address");
    }
    const email = normalizeEmail(trimmed);
    return { kind: "email", value: email, pattern: email };
  }

  const domain = trimmed.toLowerCase();
  if (!DOMAIN_RE.test(domain)) {
    throw new Error("Enter a valid email or a domain such as @google.com");
  }
  return { kind: "domain", value: domain, pattern: `@${domain}` };
}

export function matchExclusion(
  email: string,
  rules: Array<Pick<ExclusionRule, "kind" | "value">>,
): { filtered: boolean; reason: string | null } {
  const normalized = normalizeEmail(email);
  const at = normalized.lastIndexOf("@");
  const domain = at > 0 ? normalized.slice(at + 1).toLowerCase() : "";

  for (const rule of rules) {
    if (rule.kind === "email" && normalized === normalizeEmail(rule.value)) {
      return { filtered: true, reason: `Excluded address ${rule.value}` };
    }
    if (rule.kind === "domain" && domain === rule.value) {
      return { filtered: true, reason: `Excluded domain @${rule.value}` };
    }
  }
  return { filtered: false, reason: null };
}
