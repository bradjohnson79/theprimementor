const GENERIC_LOCAL_PARTS = new Set([
  "admin",
  "administrator",
  "contact",
  "hello",
  "info",
  "mail",
  "office",
  "sales",
  "support",
  "team",
  "user",
  "users",
]);

function titleCaseName(value: string): string {
  return value
    .split(/([\s'-])/)
    .map((part) => {
      if (part === " " || part === "-" || part === "'") return part;
      if (!part) return part;
      return part.charAt(0).toLocaleUpperCase() + part.slice(1).toLocaleLowerCase();
    })
    .join("");
}

export function extractFirstName(displayName: string | null | undefined, email?: string | null): string | null {
  const cleaned = displayName?.replace(/["<>]/g, " ").replace(/\s+/g, " ").trim() ?? "";
  if (cleaned) {
    const first = cleaned.split(" ")[0]?.replace(/,+$/, "") ?? "";
    if (first && /[\p{L}]/u.test(first)) {
      return titleCaseName(first);
    }
  }

  if (!email) return null;
  const local = email.split("@")[0]?.trim() ?? "";
  if (!local || GENERIC_LOCAL_PARTS.has(local.toLowerCase())) return null;
  if (!/^[a-zA-Z][a-zA-Z'-]{1,29}$/.test(local)) return null;
  return titleCaseName(local);
}
