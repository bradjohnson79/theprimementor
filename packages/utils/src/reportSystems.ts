import { getReportTierDefinition, type ReportTierDefinition } from "./reportTiers.js";
import {
  REPORT_PRODUCTS,
  isPremiumReportProduct,
  type ReportProductKey,
} from "./reportProducts.js";

export type ReportCalculationSystem = ReportTierDefinition["includeSystems"][number];

export const REPORT_SYSTEM_PUBLIC_LABELS: Record<ReportCalculationSystem, string> = {
  astrology: "Vedic Astrology",
  numerology: "Pythagorean Numerology",
  humanDesign: "Human Design",
  chinese: "Chinese BaZi Astrology",
  kabbalah: "Kabbalah",
  rune: "Runes",
};

/** Same mapping used when a member report is created. Coverage differs by product. */
export function getSystemsForReportType(
  reportType: ReportProductKey,
): readonly ReportCalculationSystem[] {
  const product = REPORT_PRODUCTS[reportType];
  if (isPremiumReportProduct(product)) {
    return getReportTierDefinition(product.tier).includeSystems;
  }
  return getReportTierDefinition(reportType === "annual_12_month" ? "deep_dive" : "intro")
    .includeSystems;
}

export function getPublicSystemLabelsForReport(reportType: ReportProductKey): string[] {
  return getSystemsForReportType(reportType).map((system) => REPORT_SYSTEM_PUBLIC_LABELS[system]);
}

export function isValidSamplePdfUrl(url: string | null | undefined): boolean {
  if (typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = trimmed.startsWith("/")
      ? new URL(trimmed, "https://theprimementor.com")
      : new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    return parsed.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}
