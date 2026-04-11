/**
 * Shared allowlists for report HTML (markdown → HTML pipeline).
 * Use in API (isomorphic-dompurify) and admin (dompurify) — keep in lockstep.
 */
export const REPORT_ALLOWED_HTML_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "p",
  "br",
  "strong",
  "em",
  "b",
  "i",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "code",
  "pre",
  "hr",
] as const;

export const REPORT_ALLOWED_HTML_ATTR = ["href", "target", "rel"] as const;
