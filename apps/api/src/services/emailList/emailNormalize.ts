const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: string): string {
  const trimmed = value.replace(/^\uFEFF/, "").trim();
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return trimmed.toLowerCase();
  }
  const local = trimmed.slice(0, at).trim().toLowerCase();
  const domain = trimmed.slice(at + 1).trim().toLowerCase();
  return `${local}@${domain}`;
}

export function emailsMatch(left: string, right: string): boolean {
  return normalizeEmail(left) === normalizeEmail(right);
}

export function isValidEmail(value: string): boolean {
  const normalized = normalizeEmail(value);
  if (!EMAIL_RE.test(normalized)) return false;
  const [local, domain] = normalized.split("@");
  if (!local || !domain) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return false;
  if (domain.startsWith(".") || domain.endsWith(".") || !domain.includes(".")) return false;
  return true;
}

export function displayEmail(value: string): string {
  return value.trim();
}
