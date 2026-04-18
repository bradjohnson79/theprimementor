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
import type {
  InterpretationReport,
  InterpretationSectionChunk,
  ReportStructuredData,
  StoredGeneratedReport,
} from "./blueprint/types.js";

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
  structuredData?: ReportStructuredData | null,
): {
  generated_report: StoredGeneratedReport;
  full_markdown: string;
  display_title: string;
  interpretation_tier: InterpretationTier;
} {
  const sections = interpretationToSections(report);
  const full_markdown = compileFullMarkdownFromSections(sections);
  const ordered_sections = Object.entries(sections).map(([key, content]) => ({
    key: key as keyof InterpretationReport,
    title: buildDisplayTitleForSectionKey(key as InterpretationSectionKey),
    content,
  })) satisfies InterpretationSectionChunk[];
  return {
    generated_report: {
      sections: report,
      ordered_sections,
      structured_data: structuredData ?? null,
    },
    full_markdown,
    display_title: buildDisplayTitle(tier, fullName),
    interpretation_tier: tier,
  };
}

function buildDisplayTitleForSectionKey(key: InterpretationSectionKey) {
  return {
    overview: "Overview",
    coreIdentity: "Core Identity",
    strengths: "Strengths",
    challenges: "Challenges",
    lifeDirection: "Life Direction",
    relationships: "Relationships",
    closingGuidance: "Closing Guidance",
    practices: "Alignment Practices",
    forecast: "Forecast",
  }[key];
}

export function getStructuredDataFromStoredReport(generated: unknown): ReportStructuredData | null {
  if (!generated || typeof generated !== "object") return null;
  const g = generated as Record<string, unknown>;
  if (!g.structured_data || typeof g.structured_data !== "object" || Array.isArray(g.structured_data)) {
    return null;
  }
  return g.structured_data as ReportStructuredData;
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
