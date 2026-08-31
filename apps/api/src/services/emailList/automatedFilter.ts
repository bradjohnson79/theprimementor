export interface FilterSignals {
  email: string;
  displayName?: string | null;
  headers?: Record<string, string | undefined>;
}

const LOCAL_PART_PATTERNS = [
  /no-?reply/i,
  /do-?not-?reply/i,
  /donotreply/i,
  /mailer-daemon/i,
  /postmaster/i,
  /^bounce(?:[.+_-]|$)/i,
  /notifications?/i,
  /automated/i,
  /receipts?/i,
  /^noreply$/i,
];

const PLATFORM_LOCAL_PARTS = new Set([
  "noreply",
  "no-reply",
  "donotreply",
  "do-not-reply",
  "mailer-daemon",
  "postmaster",
  "bounce",
  "notifications",
  "notification",
  "automated",
  "receipts",
  "billing",
  "invoice",
  "invoices",
]);

function headerValue(headers: Record<string, string | undefined> | undefined, name: string) {
  if (!headers) return "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return match?.[1]?.trim() ?? "";
}

export function classifyAutomatedAddress(input: FilterSignals): { filtered: boolean; reason: string | null } {
  const email = input.email.trim();
  const at = email.lastIndexOf("@");
  const local = (at > 0 ? email.slice(0, at) : email).toLowerCase();
  const display = (input.displayName ?? "").toLowerCase();

  if (PLATFORM_LOCAL_PARTS.has(local) || LOCAL_PART_PATTERNS.some((pattern) => pattern.test(local))) {
    return { filtered: true, reason: "Automated or system sender address" };
  }

  const precedence = headerValue(input.headers, "precedence").toLowerCase();
  if (precedence === "bulk" || precedence === "list" || precedence === "junk") {
    return { filtered: true, reason: "Bulk or list precedence header" };
  }

  const autoSubmitted = headerValue(input.headers, "auto-submitted").toLowerCase();
  if (autoSubmitted && autoSubmitted !== "no") {
    return { filtered: true, reason: "Auto-submitted message" };
  }

  if (headerValue(input.headers, "list-id") || headerValue(input.headers, "list-unsubscribe")) {
    if (LOCAL_PART_PATTERNS.some((pattern) => pattern.test(local)) || /mailer|newsletter|notify/.test(local + display)) {
      return { filtered: true, reason: "Mailing-list or unsubscribe metadata" };
    }
  }

  if (/(no.?reply|do not reply|automated message|mailer-daemon)/i.test(display)) {
    return { filtered: true, reason: "Automated display name" };
  }

  return { filtered: false, reason: null };
}
