import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: true });

/**
 * Parse markdown to HTML string. Output is NOT sanitized — run DOMPurify or isomorphic-dompurify in the host app.
 */
export function markdownToHtmlUnsafe(markdown: string): string {
  if (!markdown.trim()) return "";
  const result = marked.parse(markdown, { async: false });
  return typeof result === "string" ? result : "";
}
