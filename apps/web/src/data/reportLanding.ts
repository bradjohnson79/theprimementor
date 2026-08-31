import {
  REPORT_PRODUCTS,
  getPublicSystemLabelsForReport,
  isValidSamplePdfUrl,
  type ReportProductKey,
} from "@wisdom/utils";
import annualAvif from "../assets/reports/divin8-12-month-annual-report.avif";
import annualAvif640 from "../assets/reports/divin8-12-month-annual-report-640.avif";
import annualWebp from "../assets/reports/divin8-12-month-annual-report.webp";
import annualWebp640 from "../assets/reports/divin8-12-month-annual-report-640.webp";
import threeQuestionsAvif from "../assets/reports/divin8-3-questions-report.avif";
import threeQuestionsAvif640 from "../assets/reports/divin8-3-questions-report-640.avif";
import threeQuestionsWebp from "../assets/reports/divin8-3-questions-report.webp";
import threeQuestionsWebp640 from "../assets/reports/divin8-3-questions-report-640.webp";
import compatibilityAvif from "../assets/reports/divin8-partner-compatibility-report.avif";
import compatibilityAvif640 from "../assets/reports/divin8-partner-compatibility-report-640.avif";
import compatibilityWebp from "../assets/reports/divin8-partner-compatibility-report.webp";
import compatibilityWebp640 from "../assets/reports/divin8-partner-compatibility-report-640.webp";
import deepDiveAvif from "../assets/reports/divin8-deep-dive-report.avif";
import deepDiveAvif640 from "../assets/reports/divin8-deep-dive-report-640.avif";
import deepDiveWebp from "../assets/reports/divin8-deep-dive-report.webp";
import deepDiveWebp640 from "../assets/reports/divin8-deep-dive-report-640.webp";
import initiateAvif from "../assets/reports/divin8-initiate-report.avif";
import initiateAvif640 from "../assets/reports/divin8-initiate-report-640.avif";
import initiateWebp from "../assets/reports/divin8-initiate-report.webp";
import initiateWebp640 from "../assets/reports/divin8-initiate-report-640.webp";
import introAvif from "../assets/reports/divin8-introductory-report.avif";
import introAvif640 from "../assets/reports/divin8-introductory-report-640.avif";
import introWebp from "../assets/reports/divin8-introductory-report.webp";
import introWebp640 from "../assets/reports/divin8-introductory-report-640.webp";

export interface ReportCoverSources {
  webp: string;
  avif: string;
  webp640: string;
  avif640: string;
  width: number;
  height: number;
  alt: string;
}

export interface ReportSampleConfig {
  samplePdfUrl: string | null;
  samplePdfLabel: string;
}

export interface ReportComparisonRow {
  key: ReportProductKey;
  bestFor: string;
  depth: string;
  primaryFocus: string;
  personalInformation: string;
  partnerInformation: string;
  questionsIncluded: string;
  annualTiming: string;
}

export const REPORT_LANDING_CANONICAL = "https://theprimementor.com/reports";
export const REPORT_LANDING_OG_IMAGE = "https://theprimementor.com/images/divin8-reports-og.webp";
export const REPORT_LANDING_TITLE = "Personalized Astrology & Numerology Reports | Divin8";
export const REPORT_LANDING_DESCRIPTION =
  "Explore personalized Divin8 Reports combining multiple astrology and numerology systems into detailed insights for your life blueprint, relationships, questions and year ahead.";

export const PATHWAY_A_KEYS = [
  "intro",
  "deep_dive",
  "initiate",
] as const satisfies readonly ReportProductKey[];
export const PATHWAY_B_QUESTION_KEY = "three_questions" as const satisfies ReportProductKey;
export const PATHWAY_B_COMPATIBILITY_KEY = "compatibility" as const satisfies ReportProductKey;
export const PATHWAY_B_ANNUAL_KEY = "annual_12_month" as const satisfies ReportProductKey;

export const REPORT_COVERS: Record<ReportProductKey, ReportCoverSources> = {
  intro: {
    webp: introWebp,
    avif: introAvif,
    webp640: introWebp640,
    avif640: introAvif640,
    width: 1024,
    height: 1024,
    alt: "Divin8 Introductory Report cover artwork",
  },
  initiate: {
    webp: initiateWebp,
    avif: initiateAvif,
    webp640: initiateWebp640,
    avif640: initiateAvif640,
    width: 1024,
    height: 1024,
    alt: "Cover artwork titled Initiate’s Report for the Initiate Divin8 Report",
  },
  deep_dive: {
    webp: deepDiveWebp,
    avif: deepDiveAvif,
    webp640: deepDiveWebp640,
    avif640: deepDiveAvif640,
    width: 1024,
    height: 1024,
    alt: "Divin8 Deep Dive Report cover artwork",
  },
  three_questions: {
    webp: threeQuestionsWebp,
    avif: threeQuestionsAvif,
    webp640: threeQuestionsWebp640,
    avif640: threeQuestionsAvif640,
    width: 1024,
    height: 1024,
    alt: "Divin8 3 Questions Report cover artwork",
  },
  compatibility: {
    webp: compatibilityWebp,
    avif: compatibilityAvif,
    webp640: compatibilityWebp640,
    avif640: compatibilityAvif640,
    width: 1024,
    height: 1024,
    alt: "Divin8 Partner Compatibility Report cover artwork",
  },
  annual_12_month: {
    webp: annualWebp,
    avif: annualAvif,
    webp640: annualWebp640,
    avif640: annualAvif640,
    width: 1024,
    height: 1024,
    alt: "Divin8 12 Month Annual Report cover artwork",
  },
};

/** Optional sample PDFs. Leave null until an anonymized public sample is supplied. */
export const REPORT_SAMPLES: Record<ReportProductKey, ReportSampleConfig> = {
  intro: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
  deep_dive: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
  initiate: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
  three_questions: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
  compatibility: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
  annual_12_month: { samplePdfUrl: null, samplePdfLabel: "View Sample Report" },
};

export const REPORT_BEST_FOR: Record<ReportProductKey, string[]> = {
  intro: ["Foundational self-understanding", "Core identity", "Direction", "Accessible synthesis"],
  deep_dive: ["Deeper personal insight", "Life path", "Relationships", "Career"],
  initiate: [
    "Full-spectrum synthesis",
    "Advanced spiritual analysis",
    "Timing",
    "Life-path insight",
  ],
  three_questions: ["Personal questions", "Life direction", "Decision-making support"],
  compatibility: [
    "Romantic partners",
    "Business partners",
    "Creative collaborators",
    "Friendships",
    "Family relationships",
  ],
  annual_12_month: ["Annual planning", "Personal growth", "Timing cycles", "Month-by-month themes"],
};

export const REPORT_COMPARISON: ReportComparisonRow[] = [
  {
    key: "intro",
    bestFor: "Foundational self-understanding",
    depth: "Foundational",
    primaryFocus: "Core identity and direction",
    personalInformation: "Birth date, location, and optional birth time",
    partnerInformation: "Not required",
    questionsIncluded: "None",
    annualTiming: "Not included",
  },
  {
    key: "deep_dive",
    bestFor: "Deeper personal insight",
    depth: "Comprehensive",
    primaryFocus: "Life path, relationships, and career",
    personalInformation: "Birth date, location, and optional birth time",
    partnerInformation: "Not required",
    questionsIncluded: "None",
    annualTiming: "Not included",
  },
  {
    key: "initiate",
    bestFor: "Full-spectrum metaphysical synthesis",
    depth: "Most comprehensive",
    primaryFocus: "Advanced spiritual and life-path analysis",
    personalInformation: "Birth date, location, and optional birth time",
    partnerInformation: "Not required",
    questionsIncluded: "None",
    annualTiming: "Not included",
  },
  {
    key: "three_questions",
    bestFor: "Specific personal questions",
    depth: "Focused",
    primaryFocus: "Answers to three selected questions",
    personalInformation: "Birth date, location, and optional birth time",
    partnerInformation: "Not required",
    questionsIncluded: "Three questions",
    annualTiming: "Not included",
  },
  {
    key: "compatibility",
    bestFor: "Relationship or partnership insight",
    depth: "Focused",
    primaryFocus: "Two-person synthesis",
    personalInformation: "Birth information for both people",
    partnerInformation: "Required",
    questionsIncluded: "Optional relationship question",
    annualTiming: "Not included",
  },
  {
    key: "annual_12_month",
    bestFor: "Planning the year ahead",
    depth: "Comprehensive timing",
    primaryFocus: "Month-by-month themes and timing",
    personalInformation: "Birth date, location, and optional birth time",
    partnerInformation: "Not required",
    questionsIncluded: "None",
    annualTiming: "Twelve calendar months",
  },
];

export const REPORT_LANDING_FAQS = [
  {
    id: "information",
    question: "What information do I need to provide?",
    answer:
      "Every report begins with your name, email, birth date, and birth location. Birth time is optional; if it is unknown, the intake uses 00:00. The 3 Questions Report also asks for three written questions. The Compatibility Report collects birth information for two people and the type of relationship you want examined. The 12 Month Annual Report can include optional areas of focus for the year ahead.",
  },
  {
    id: "systems",
    question: "Which astrology and numerology systems are used?",
    answer:
      "Included calculations vary by report. The Introductory, 3 Questions, and Compatibility Reports use Vedic astrology, Pythagorean numerology, and runes. The Deep Dive and 12 Month Annual Reports add Human Design and Chinese BaZi astrology. The Initiate Divin8 Report includes those systems plus Kabbalah. Western astrology, Tarot, and I Ching are not part of the current report calculations.",
  },
  {
    id: "choose",
    question: "Which report should I choose?",
    answer:
      "Begin with the Introductory Divin8 Report for a foundational look at your blueprint. Choose the Deep Dive or Initiate reports for broader personal synthesis. Use the 3 Questions Report for three specific concerns, the Compatibility Report when two people’s charts should be read together, and the 12 Month Annual Report for month-by-month timing across the coming year. You do not need to purchase them in sequence.",
  },
  {
    id: "birth-time",
    question: "Do I need an exact birth time?",
    answer:
      "An exact birth time is preferred because it supports more precise natal placements, but it is not required. If you leave birth time blank, the report intake defaults to 00:00.",
  },
  {
    id: "compatibility",
    question: "How does the Partner Compatibility Report work?",
    answer:
      "You provide birth information for two people and select the relationship type—romantic, business, creative partnership, friendship, family, or other. The report compares both personal blueprints and interprets the dynamic between them.",
  },
  {
    id: "questions",
    question: "What kinds of questions can I ask?",
    answer:
      "The 3 Questions Report is designed for three personally selected questions about your life, direction, relationships, or decisions. Each question needs enough detail to interpret—at least ten characters—and should be a real question rather than placeholder text. The report does not promise a specific future outcome.",
  },
  {
    id: "receive",
    question: "How will I receive my report?",
    answer:
      "Order through a free Prime Mentor account. After you submit your intake information and complete checkout, the report is generated and prepared for you in your member dashboard.",
  },
  {
    id: "delivery",
    question: "When will my report be delivered?",
    answer: "Your report is delivered within 48 hours Monday–Friday.",
  },
  {
    id: "samples",
    question: "Are sample reports available?",
    answer:
      "Sample reports are being prepared. When an anonymized sample is available for a report, a View Sample Report action will appear with that report.",
  },
] as const;

export function getReportSample(
  key: ReportProductKey,
): ReportSampleConfig & { available: boolean } {
  const sample = REPORT_SAMPLES[key];
  return {
    ...sample,
    available: isValidSamplePdfUrl(sample.samplePdfUrl),
  };
}

export function hasAnyReportSample(): boolean {
  return (Object.keys(REPORT_SAMPLES) as ReportProductKey[]).some(
    (key) => getReportSample(key).available,
  );
}

export function getReportSystems(key: ReportProductKey): string[] {
  return getPublicSystemLabelsForReport(key);
}

export function getReportDisplayName(key: ReportProductKey): string {
  return REPORT_PRODUCTS[key].displayName;
}
