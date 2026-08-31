import { extractFirstName } from "./firstName.js";
import { emailsMatch, normalizeEmail } from "./emailNormalize.js";

export interface ParsedAddress {
  email: string;
  displayName: string | null;
  firstName: string | null;
}

const ADDRESS_RE = /(?:"?([^"<]*)"?\s*)?<([^>]+)>|([^\s,;]+@[^\s,;]+)/g;

export function parseAddressList(value: string | null | undefined): ParsedAddress[] {
  if (!value?.trim()) return [];
  const matches = [...value.matchAll(ADDRESS_RE)];
  const results: ParsedAddress[] = [];
  for (const match of matches) {
    const rawEmail = (match[2] || match[3] || "").trim();
    if (!rawEmail.includes("@")) continue;
    const email = normalizeEmail(rawEmail);
    const displayName = match[1]?.trim() || null;
    results.push({
      email,
      displayName,
      firstName: extractFirstName(displayName, email),
    });
  }
  return results;
}

export function headerMap(headers: Array<{ name?: string | null; value?: string | null }> | undefined): Record<string, string> {
  const map: Record<string, string> = {};
  for (const header of headers ?? []) {
    const name = header.name?.trim();
    if (!name || header.value == null) continue;
    map[name] = header.value;
  }
  return map;
}

export function isOwnerAddress(email: string, ownerAddresses: string[]): boolean {
  return ownerAddresses.some((owner) => emailsMatch(owner, email));
}
