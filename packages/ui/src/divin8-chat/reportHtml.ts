import DOMPurify from "dompurify";
import {
  markdownToHtmlUnsafe,
  REPORT_ALLOWED_HTML_ATTR,
  REPORT_ALLOWED_HTML_TAGS,
} from "@wisdom/utils";

export function renderReportMarkdownToSafeHtml(markdown: string): string {
  const raw = markdownToHtmlUnsafe(markdown);
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [...REPORT_ALLOWED_HTML_TAGS],
    ALLOWED_ATTR: [...REPORT_ALLOWED_HTML_ATTR],
  });
}
