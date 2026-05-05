import type { BlueprintData, InterpretationReport } from "../blueprint/index.js";
import {
  runDivin8Execution,
  type Divin8ExecutionResult,
  type Divin8Input,
} from "../divin8EngineService.js";

type RawIntake = Record<string, unknown>;

function isRecord(value: unknown): value is RawIntake {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => getString(item)).filter((item): item is string => Boolean(item)) : [];
}

function rawIntake(input: Divin8Input): RawIntake {
  return isRecord(input.metadata?.raw_intake) ? input.metadata.raw_intake : {};
}

function buildInterpretation(sections: Partial<InterpretationReport>): InterpretationReport {
  return {
    overview: sections.overview ?? "",
    coreIdentity: sections.coreIdentity ?? "",
    strengths: sections.strengths ?? "",
    challenges: sections.challenges ?? "",
    lifeDirection: sections.lifeDirection ?? "",
    relationships: sections.relationships ?? "",
    closingGuidance: sections.closingGuidance ?? "",
    practices: sections.practices ?? "",
    forecast: sections.forecast ?? "",
  };
}

function buildOutput(
  input: Divin8Input,
  interpretation: InterpretationReport,
  generatedAt = new Date().toISOString(),
) {
  const sections = Object.entries(interpretation).map(([key, content]) => ({
    key,
    title: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
    content,
  }));
  return {
    summary: interpretation.overview,
    sections,
    systems_used: input.systems ?? [],
    generated_at: generatedAt,
    version: 1,
    order_id: input.order_id ?? null,
    user_id: input.user_id ?? null,
  };
}

function withCasualOutput(
  base: Divin8ExecutionResult,
  input: Divin8Input,
  interpretation: InterpretationReport,
  tier: "three_questions" | "compatibility" | "annual_12_month",
): Divin8ExecutionResult {
  return {
    ...base,
    input,
    output: buildOutput(input, interpretation, base.output.generated_at),
    interpretation,
    tier,
  };
}

function personInput(input: Divin8Input, person: RawIntake, label: string): Divin8Input {
  return {
    ...input,
    birth_date: getString(person.birthDate) ?? input.birth_date,
    birth_time: getString(person.birthTime) ?? input.birth_time,
    birth_location: getString(person.birthPlaceName) ?? input.birth_location,
    metadata: {
      ...input.metadata,
      full_name: getString(person.fullName) ?? label,
      client_name: getString(person.fullName) ?? label,
    },
  };
}

export function generateAnnualMonthLabels(timezone: string | null | undefined, now = new Date()): string[] {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: timezone || undefined,
  });
  const partsFormatter = new Intl.DateTimeFormat("en-CA", {
    month: "numeric",
    year: "numeric",
    timeZone: timezone || undefined,
  });
  const parts = partsFormatter.formatToParts(now);
  const month = Number(parts.find((part) => part.type === "month")?.value ?? now.getUTCMonth() + 1);
  const year = Number(parts.find((part) => part.type === "year")?.value ?? now.getUTCFullYear());

  return Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index, 1, 12));
    return formatter.format(date);
  });
}

export async function generateThreeQuestionsReport(input: Divin8Input): Promise<Divin8ExecutionResult> {
  const base = await runDivin8Execution({ ...input, reading_type: "introductory" });
  const intake = rawIntake(input);
  const questions = [getString(intake.question1), getString(intake.question2), getString(intake.question3)]
    .filter((entry): entry is string => Boolean(entry));
  const interpretation = buildInterpretation({
    overview: `Client Overview\n\n${base.interpretation.overview}`,
    coreIdentity: `Core Divin8 Snapshot\n\n${base.interpretation.coreIdentity}`,
    strengths: `Question 1 Interpretation\n\nQuestion: ${questions[0] ?? "Not provided"}\n\n${base.interpretation.lifeDirection}`,
    challenges: `Question 2 Interpretation\n\nQuestion: ${questions[1] ?? "Not provided"}\n\n${base.interpretation.challenges}`,
    lifeDirection: `Question 3 Interpretation\n\nQuestion: ${questions[2] ?? "Not provided"}\n\n${base.interpretation.relationships}`,
    closingGuidance: `Overall Synthesis\n\n${base.interpretation.closingGuidance}`,
    practices: "Practical Guidance\n\nUse the answers as reflection points rather than fixed predictions. Notice which answer names the clearest next action, which names a pattern to stop feeding, and which names a truth that needs more patience.",
  });
  return withCasualOutput(base, input, interpretation, "three_questions");
}

export async function generateCompatibilityReport(input: Divin8Input): Promise<Divin8ExecutionResult> {
  const intake = rawIntake(input);
  const personA = isRecord(intake.personA) ? intake.personA : {};
  const personB = isRecord(intake.personB) ? intake.personB : {};
  const relationshipType = getString(intake.relationshipType) ?? "other";
  const [personAResult, personBResult] = await Promise.all([
    runDivin8Execution({ ...personInput(input, personA, "Person A"), reading_type: "introductory" }),
    runDivin8Execution({ ...personInput(input, personB, "Person B"), reading_type: "introductory" }),
  ]);
  const isBusinessLike = relationshipType === "business" || relationshipType === "creative_partnership";
  const relationshipFrame = isBusinessLike
    ? "Keep the interpretation professional: focus on trust, communication, decision-making, complementary strengths, pressure points, and shared execution. Do not use romance, attraction, intimacy, soulmate, or couple language."
    : relationshipType === "romantic"
      ? "Include emotional compatibility, attraction patterns, attachment needs, and long-term relational growth without fatalistic claims."
      : "Keep the tone balanced and appropriate to the selected relationship type without assuming romance.";
  const interpretation = buildInterpretation({
    overview: `Introduction\n\nThis compatibility report is written for a ${relationshipType.replace(/_/g, " ")} connection. ${relationshipFrame}`,
    coreIdentity: `Person A Overview\n\n${personAResult.interpretation.overview}\n\nPerson B Overview\n\n${personBResult.interpretation.overview}`,
    strengths: `Core Compatibility Synthesis\n\nPerson A brings: ${personAResult.interpretation.strengths}\n\nPerson B brings: ${personBResult.interpretation.strengths}`,
    relationships: `Emotional and Communication Dynamic\n\n${isBusinessLike ? "For this partnership, emotional language is translated into professional trust, responsiveness, and pressure management." : ""}\n\nPerson A relational pattern: ${personAResult.interpretation.relationships}\n\nPerson B relational pattern: ${personBResult.interpretation.relationships}`,
    challenges: `Challenges and Growth Areas\n\nPerson A pressure pattern: ${personAResult.interpretation.challenges}\n\nPerson B pressure pattern: ${personBResult.interpretation.challenges}`,
    lifeDirection: `Long-Term Potential\n\n${personAResult.interpretation.lifeDirection}\n\n${personBResult.interpretation.lifeDirection}`,
    closingGuidance: `Practical Guidance\n\n${getString(intake.desiredFocus) ? `Desired focus: ${getString(intake.desiredFocus)}\n\n` : ""}${personAResult.interpretation.closingGuidance}\n\n${personBResult.interpretation.closingGuidance}`,
  });
  return {
    ...withCasualOutput(personAResult, input, interpretation, "compatibility"),
    blueprint: {
      ...personAResult.blueprint,
      compatibility: {
        personA: personAResult.blueprint,
        personB: personBResult.blueprint,
        relationshipType,
      },
    } as BlueprintData,
  };
}

export async function generateAnnual12MonthReport(input: Divin8Input): Promise<Divin8ExecutionResult> {
  const base = await runDivin8Execution({ ...input, reading_type: "deep_dive" });
  const intake = rawIntake(input);
  const timezone = getString(intake.birthTimezone) ?? getString(input.metadata?.timezone);
  const months = generateAnnualMonthLabels(timezone);
  const areas = getStringArray(intake.areasOfInterest);
  const monthSections = months
    .map((month, index) => `Month ${index + 1}: ${month}\n\nTheme: ${base.interpretation.forecast || base.interpretation.lifeDirection}`)
    .join("\n\n");
  const interpretation = buildInterpretation({
    overview: `Client Overview\n\n${base.interpretation.overview}`,
    coreIdentity: `Annual Theme\n\n${base.interpretation.coreIdentity}`,
    forecast: monthSections,
    strengths: `Key Opportunities\n\n${base.interpretation.strengths}`,
    challenges: `Key Cautions\n\n${base.interpretation.challenges}`,
    lifeDirection: `Best Months for Action\n\nReview the months where momentum, clarity, and external support are strongest. Areas of interest: ${areas.join(", ") || "general life direction"}.`,
    practices: "Best Months for Reflection\n\nUse quieter months for integration, planning, repair, and spiritual refinement rather than forcing outcomes.",
    closingGuidance: `Summary and Guidance\n\n${base.interpretation.closingGuidance}`,
  });
  return withCasualOutput(base, input, interpretation, "annual_12_month");
}
