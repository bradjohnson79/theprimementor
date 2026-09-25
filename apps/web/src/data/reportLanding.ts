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

export { REPORT_PUBLIC_MARKETING_PATHS, isReportsMarketingPath } from "../lib/reportMarketingPaths";

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

/** Anonymized public sample PDFs. Compatibility has no published sample yet. */
export const REPORT_SAMPLES: Record<ReportProductKey, ReportSampleConfig> = {
  intro: {
    samplePdfUrl: "/samples/divin8-introductory-report-sample.pdf",
    samplePdfLabel: "View Sample",
  },
  deep_dive: {
    samplePdfUrl: "/samples/divin8-deep-dive-report-sample.pdf",
    samplePdfLabel: "View Sample",
  },
  initiate: {
    samplePdfUrl: "/samples/divin8-initiate-report-sample.pdf",
    samplePdfLabel: "View Sample",
  },
  three_questions: {
    samplePdfUrl: "/samples/divin8-3-questions-report-sample.pdf",
    samplePdfLabel: "View Sample",
  },
  compatibility: { samplePdfUrl: null, samplePdfLabel: "View Sample" },
  annual_12_month: {
    samplePdfUrl: "/samples/divin8-12-month-annual-report-sample.pdf",
    samplePdfLabel: "View Sample",
  },
};

export const REPORT_DELIVERY_SENTENCE =
  "Your report is delivered within 24 hours Monday–Friday.";

export const REPORT_PRODUCT_LANDINGS = [
  {
    path: "/reports/introductory",
    productKey: "intro" as const satisfies ReportProductKey,
    headline: "Personalized Birth & Natal Insight Report",
    pageSource: "reports_introductory",
    canonical: "https://theprimementor.com/reports/introductory",
    title: "Introductory Divin8 Report | Personalized Natal Insight",
    description:
      "A personalized Introductory Divin8 Report covering core identity, strengths and challenges, and life direction from your birth information.",
  },
  {
    path: "/reports/compatibility",
    productKey: "compatibility" as const satisfies ReportProductKey,
    headline: "Personalized Relationship Compatibility Report",
    pageSource: "reports_compatibility",
    canonical: "https://theprimementor.com/reports/compatibility",
    title: "Partner Compatibility Report | Divin8 Relationship Insight",
    description:
      "A personalized Divin8 Compatibility Report comparing two birth charts for strengths, challenges, communication, and relationship dynamics.",
  },
] as const;

export const REPORT_FUTURE_MARKETING_SLUGS = {
  annual: "annual_12_month",
  "3-questions": "three_questions",
} as const;

export const REPORT_REQUIRED_INFO: Record<ReportProductKey, string> = {
  intro: "Name, email, birth date, and birth location. Birth time is optional.",
  deep_dive: "Name, email, birth date, and birth location. Birth time is optional.",
  initiate: "Name, email, birth date, and birth location. Birth time is optional.",
  three_questions:
    "Name, email, birth date, birth location, and three written questions. Birth time is optional.",
  compatibility:
    "Birth information for two people and the type of relationship you want examined.",
  annual_12_month:
    "Name, email, birth date, and birth location. Birth time is optional. You may add optional areas of focus for the year ahead.",
};

export const REPORT_HOW_IT_WORKS = [
  {
    title: "Choose your report",
    body: "Select the report that best matches what you want to explore.",
  },
  {
    title: "Provide your information",
    body: "Complete the required birth and report-intake information.",
  },
  {
    title: "Your report is prepared",
    body: "After checkout, the report is generated and prepared for your member dashboard.",
  },
  {
    title: "Receive your report",
    body: REPORT_DELIVERY_SENTENCE,
  },
] as const;

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
    answer: REPORT_DELIVERY_SENTENCE,
  },
  {
    id: "written",
    question: "Is this a live session or a written report?",
    answer:
      "You are purchasing a written digital report, not a live consultation. After checkout, the finished report is prepared for your member dashboard.",
  },
  {
    id: "samples",
    question: "Are sample reports available?",
    answer:
      "Anonymized sample PDFs are available for the Introductory, 3 Questions, Deep Dive, 12 Month Annual, and Initiate reports. Client names in those samples have been changed for confidentiality. A Partner Compatibility sample is not published yet.",
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
