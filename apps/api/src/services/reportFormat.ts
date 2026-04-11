import createDOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";
import {
  INTERPRETATION_SECTION_KEYS,
  type InterpretationSectionKey,
  compileFullMarkdownFromSections,
  buildDisplayTitle,
  interpretationToSections,
  type InterpretationTier,
  markdownToHtmlUnsafe,
  REPORT_ALLOWED_HTML_ATTR,
  REPORT_ALLOWED_HTML_TAGS,
} from "@wisdom/utils";
import type { InterpretationReport } from "./blueprint/types.js";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window as unknown as typeof window);

export function sanitizeReportHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [...REPORT_ALLOWED_HTML_TAGS],
    ALLOWED_ATTR: [...REPORT_ALLOWED_HTML_ATTR],
  });
}

export function markdownToSanitizedHtml(markdown: string): string {
  const raw = markdownToHtmlUnsafe(markdown);
  return sanitizeReportHtml(raw);
}

/** Legacy flat `{ overview, ... }` or new `{ sections: {...} }` */
export function getSectionsFromStoredReport(generated: unknown): Partial<
  Record<InterpretationSectionKey, string>
> | null {
  if (!generated || typeof generated !== "object") return null;
  const g = generated as Record<string, unknown>;
  if (g.sections && typeof g.sections === "object") {
    return g.sections as Partial<Record<InterpretationSectionKey, string>>;
  }
  const first = g.overview;
  if (typeof first === "string" || first === undefined) {
    const out: Partial<Record<InterpretationSectionKey, string>> = {};
    for (const key of INTERPRETATION_SECTION_KEYS) {
      const v = g[key];
      if (typeof v === "string") out[key] = v;
    }
    return out;
  }
  return null;
}

export function persistableInterpretationPayload(
  report: InterpretationReport,
  tier: InterpretationTier,
  fullName: string,
): {
  generated_report: { sections: InterpretationReport };
  full_markdown: string;
  display_title: string;
  interpretation_tier: InterpretationTier;
} {
  const sections = interpretationToSections(report);
  const full_markdown = compileFullMarkdownFromSections(sections);
  return {
    generated_report: { sections: report },
    full_markdown,
    display_title: buildDisplayTitle(tier, fullName),
    interpretation_tier: tier,
  };
}

export function parseInterpretTier(body: unknown): InterpretationTier {
  const t = body && typeof body === "object" ? (body as { tier?: unknown }).tier : undefined;
  if (t === "deep_dive" || t === "initiate" || t === "intro") return t;
  throw new Error("Missing or invalid interpretation tier");
}

/**
 * Canonical markdown for display/export: prefer stored column, else always rebuild from sections.
 */
export function resolveFullMarkdown(
  full_markdown: string | null | undefined,
  generated_report: unknown,
): string {
  if (full_markdown?.trim()) return full_markdown.trim();
  const sections = getSectionsFromStoredReport(generated_report);
  if (sections) return compileFullMarkdownFromSections(sections);
  return "";
}
