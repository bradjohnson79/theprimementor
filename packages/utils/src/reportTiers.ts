export type ReportTierId = "intro" | "deep_dive" | "initiate";

export type TierReasoningEffort = "low" | "medium" | "high";

export interface ReportTierSystemsConfig {
  vedic: "light" | "full";
  numerology: "core" | "full";
  humanDesign: boolean;
  chinese: boolean;
  kabbalah: boolean;
  rune: boolean;
}

export interface ReportTierDefinition {
  id: ReportTierId;
  label: string;
  shortLabel: string;
  accent: "emerald" | "amber" | "rose";
  description: string;
  systems: ReportTierSystemsConfig;
  includeSystems: Array<"astrology" | "numerology" | "humanDesign" | "chinese" | "kabbalah" | "rune">;
  model: string;
  reasoning: TierReasoningEffort;
  deepThinking: boolean;
  outputStyle: string;
}

export type BlueprintSystemName =
  | "astrology"
  | "numerology"
  | "humanDesign"
  | "chinese"
  | "kabbalah"
  | "rune"
  | "iching"
  | "bodymap"
  | "physiognomy";

export const REPORT_TIER_ORDER: ReportTierId[] = ["intro", "deep_dive", "initiate"];

export const REPORT_TIER_DEFINITIONS: Record<ReportTierId, ReportTierDefinition> = {
  intro: {
    id: "intro",
    label: "Introductory",
    shortLabel: "Intro",
    accent: "emerald",
    description:
      "Divin8 Introductory Report\n\nA clear and focused orientation into your core energetic blueprint, combining Vedic astrology, numerology, and rune insights. This report highlights your foundational patterns, natural tendencies, and key life themes, giving you immediate clarity on how your energy is structured and expressed. It's designed to ground you in self-awareness and provide a stable starting point for deeper exploration.",
    systems: {
      vedic: "light",
      numerology: "core",
      humanDesign: false,
      chinese: false,
      kabbalah: false,
      rune: true,
    },
    includeSystems: ["astrology", "numerology", "rune"],
    model: "gpt-5.1",
    reasoning: "medium",
    deepThinking: false,
    outputStyle: "Concise, specific, and grounded. Avoid fluff.",
  },
  deep_dive: {
    id: "deep_dive",
    label: "Deep Dive",
    shortLabel: "Deep Dive",
    accent: "amber",
    description:
      "Divin8 Deep Dive Report\n\nAn expanded and layered synthesis that builds upon your core blueprint by integrating Human Design and Chinese astrology. This report reveals how your energetic mechanics function in real time-how you make decisions, interact with others, and move through cycles of change. It uncovers deeper behavioral patterns, timing influences, and energetic dynamics, offering a more strategic understanding of how to navigate your life path with precision.",
    systems: {
      vedic: "full",
      numerology: "full",
      humanDesign: true,
      chinese: true,
      kabbalah: false,
      rune: true,
    },
    includeSystems: ["astrology", "numerology", "humanDesign", "chinese", "rune"],
    model: "gpt-5.1",
    reasoning: "high",
    deepThinking: false,
    outputStyle: "Structured depth with clarity. Prevent verbosity.",
  },
  initiate: {
    id: "initiate",
    label: "Initiate",
    shortLabel: "Initiate",
    accent: "rose",
    description:
      "Divin8 Initiate's Report\n\nThe most comprehensive and advanced synthesis, incorporating Kabbalistic insights into your full multi-system blueprint. This report moves beyond interpretation into initiation-revealing deeper spiritual architecture, soul-level patterns, and the underlying intelligence guiding your path. It is designed for those ready to step into mastery, integrating all systems into a unified awareness that supports aligned action, higher perception, and long-term transformation.",
    systems: {
      vedic: "full",
      numerology: "full",
      humanDesign: true,
      chinese: true,
      kabbalah: true,
      rune: true,
    },
    includeSystems: ["astrology", "numerology", "humanDesign", "chinese", "kabbalah", "rune"],
    model: "gpt-5.1",
    reasoning: "high",
    deepThinking: true,
    outputStyle: "Full synthesis with clarity. No rambling, vagueness, or broken structure.",
  },
};

export function isReportTierId(value: unknown): value is ReportTierId {
  return value === "intro" || value === "deep_dive" || value === "initiate";
}

export function getReportTierDefinition(tier: ReportTierId): ReportTierDefinition {
  return REPORT_TIER_DEFINITIONS[tier];
}

export function systemsConfigFromIncludeSystems(
  includeSystems: BlueprintSystemName[],
): ReportTierSystemsConfig {
  return {
    vedic: includeSystems.includes("astrology") ? "full" : "light",
    numerology: includeSystems.includes("numerology") ? "full" : "core",
    humanDesign: includeSystems.includes("humanDesign"),
    chinese: includeSystems.includes("chinese"),
    kabbalah: includeSystems.includes("kabbalah"),
    rune: includeSystems.includes("rune"),
  };
}

/** Member-facing report mode labels (no model or internal engine terminology). */
export const REPORT_MODE_LABELS: Record<ReportTierId, string> = {
  intro: "Divin8 Introductory Report Mode",
  deep_dive: "Divin8 Deep Dive Report Mode",
  initiate: "Divin8 Initiate Report Mode",
};
