import { z } from "zod";
import {
  REPORT_PRODUCTS,
  type ReportIntakeSchemaKey,
  type ReportProductKey,
  resolveReportProductKey,
} from "./reportProducts.js";

const optionalText = z.string().trim().optional().nullable().transform((value) => value || null);
const requiredText = (fieldName: string) => z.string({ message: `${fieldName} is required` }).trim().min(1, `${fieldName} is required`);
const birthDate = z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Birth date must use YYYY-MM-DD");
const birthTime = z.string().trim().optional().nullable().transform((value) => value?.slice(0, 5) || "00:00");
const birthLocation = requiredText("Birth location");
const timezone = optionalText;
const question = z
  .string()
  .trim()
  .min(10, "Questions must be at least 10 characters")
  .refine((value) => !/^question\s*\d*$/i.test(value), "Please replace placeholder question text");

export const relationshipTypeSchema = z.enum([
  "romantic",
  "business",
  "creative_partnership",
  "friendship",
  "family",
  "other",
]);

const personSchema = z.object({
  fullName: requiredText("Full name"),
  birthDate,
  birthTime,
  birthPlaceName: birthLocation,
  birthLat: z.number().optional().nullable(),
  birthLng: z.number().optional().nullable(),
  birthTimezone: timezone,
  currentLocation: optionalText,
});

export const premiumReportIntakeSchema = z.object({
  fullName: requiredText("Full name"),
  email: z.string().trim().email("A valid email address is required"),
  phone: requiredText("Phone"),
  birthDate,
  birthTime,
  birthPlaceName: birthLocation,
  birthLat: z.number().optional().nullable(),
  birthLng: z.number().optional().nullable(),
  birthTimezone: requiredText("Birth timezone"),
  timezoneSource: z.enum(["user", "suggested", "fallback"]).default("user"),
  primaryFocus: optionalText,
  notes: optionalText,
  consentGiven: z.literal(true, { message: "Consent is required" }),
});

export const threeQuestionsReportIntakeSchema = premiumReportIntakeSchema.extend({
  currentLocation: optionalText,
  question1: question,
  question2: question,
  question3: question,
});

export const compatibilityReportIntakeSchema = z.object({
  email: z.string().trim().email("A valid email address is required"),
  phone: optionalText,
  personA: personSchema,
  personB: personSchema,
  relationshipType: relationshipTypeSchema,
  relationshipQuestion: optionalText,
  relationshipStatus: optionalText,
  desiredFocus: optionalText,
  consentGiven: z.literal(true, { message: "Consent is required" }),
});

export const annualReportIntakeSchema = premiumReportIntakeSchema.extend({
  currentLocation: optionalText,
  currentLifeFocus: optionalText,
  areasOfInterest: z.array(z.string().trim().min(1)).default([]),
});

export const REPORT_INTAKE_SCHEMAS = {
  premium: premiumReportIntakeSchema,
  three_questions: threeQuestionsReportIntakeSchema,
  compatibility: compatibilityReportIntakeSchema,
  annual: annualReportIntakeSchema,
} as const satisfies Record<ReportIntakeSchemaKey, z.ZodType>;

export type PremiumReportIntake = z.infer<typeof premiumReportIntakeSchema>;
export type ThreeQuestionsReportIntake = z.infer<typeof threeQuestionsReportIntakeSchema>;
export type CompatibilityReportIntake = z.infer<typeof compatibilityReportIntakeSchema>;
export type AnnualReportIntake = z.infer<typeof annualReportIntakeSchema>;
export type ReportIntake =
  | PremiumReportIntake
  | ThreeQuestionsReportIntake
  | CompatibilityReportIntake
  | AnnualReportIntake;

export function getSchemaByReportType(reportType: ReportProductKey | string) {
  const key = resolveReportProductKey(reportType);
  if (!key) {
    throw new Error(`Unknown report type: ${String(reportType)}`);
  }
  return REPORT_INTAKE_SCHEMAS[REPORT_PRODUCTS[key].intakeSchema];
}

export function parseReportIntake(reportType: ReportProductKey | string, intake: unknown): ReportIntake {
  return getSchemaByReportType(reportType).parse(intake) as ReportIntake;
}

export function formatZodIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "intake"}: ${issue.message}`).join("; ");
}
