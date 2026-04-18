/**
 * Blueprint interpretation report — section order, markdown compilation, display titles.
 * Kept in @wisdom/utils so API and admin share one canonical pipeline.
 */

export const INTERPRETATION_SECTION_KEYS = [
  "overview",
  "coreIdentity",
  "strengths",
  "challenges",
  "lifeDirection",
  "relationships",
  "closingGuidance",
  "practices",
  "forecast",
] as const;

export type InterpretationSectionKey = (typeof INTERPRETATION_SECTION_KEYS)[number];

export const SECTION_MARKDOWN_LABELS: Record<InterpretationSectionKey, string> = {
  overview: "Overview",
  coreIdentity: "Core Identity",
  strengths: "Strengths",
  challenges: "Challenges",
  lifeDirection: "Life Direction",
  relationships: "Relationships",
  closingGuidance: "Closing Guidance",
  practices: "Alignment Practices",
  forecast: "Forecast",
};

export type InterpretationTier = "intro" | "deep_dive" | "initiate";

export function tierDisplayLabel(tier: string): string {
  switch (tier) {
    case "deep_dive":
      return "Deep Dive";
    case "initiate":
      return "Initiate";
    case "intro":
    default:
      return "Introductory";
  }
}

export function buildDisplayTitle(tier: string, fullName: string): string {
  const name = fullName.trim() || "Guest";
  return `Soul Blueprint — ${tierDisplayLabel(tier)} — ${name}`;
}

/** Flat InterpretationReport-like object */
export type InterpretationSections = Record<InterpretationSectionKey, string>;

export function interpretationToSections(
  report: Partial<Record<InterpretationSectionKey, string>>,
): InterpretationSections {
  const out = {} as InterpretationSections;
  for (const key of INTERPRETATION_SECTION_KEYS) {
    out[key] = (report[key] ?? "").trim();
  }
  return out;
}

export function compileFullMarkdownFromSections(
  sections: Partial<Record<InterpretationSectionKey, string>>,
): string {
  const blocks: string[] = [];
  for (const key of INTERPRETATION_SECTION_KEYS) {
    const content = sections[key]?.trim();
    if (content) {
      blocks.push(`## ${SECTION_MARKDOWN_LABELS[key]}\n\n${content}`);
    }
  }
  return blocks.join("\n\n");
}

export function slugForFilename(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "report"
  );
}
