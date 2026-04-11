import type { AdminOrder } from "../ordersService.js";
import type { Divin8Input, Divin8ReadingType, Divin8System } from "../divin8EngineService.js";

function normalizeSystem(value: string): Divin8System | null {
  switch (value.trim().toLowerCase()) {
    case "vedic":
    case "astrology":
      return "vedic";
    case "numerology":
      return "numerology";
    case "rune":
    case "runes":
      return "runes";
    case "human_design":
    case "human-design":
    case "humandesign":
    case "humandesignsystem":
    case "humandesign system":
    case "human design":
      return "human_design";
    case "chinese":
    case "chinese_astrology":
    case "chinese-astrology":
    case "chinese astrology":
      return "chinese_astrology";
    case "kabbalah":
      return "kabbalah";
    default:
      return null;
  }
}

function mapReadingType(order: AdminOrder): Divin8ReadingType {
  const tier = (order.metadata.report_type_id ?? order.metadata.report_type ?? "").trim().toLowerCase();
  if (tier === "deep_dive" || tier === "deep dive") return "deep_dive";
  if (tier === "initiate") return "initiate";
  return "introductory";
}

function normalizeSystems(order: AdminOrder): Divin8System[] {
  const systems = order.metadata.selected_systems
    .map((system) => normalizeSystem(system))
    .filter((system): system is Divin8System => Boolean(system));
  return Array.from(new Set(systems));
}

export function mapOrderToDivin8Input(order: AdminOrder): Divin8Input {
  if (order.type !== "report" && order.type !== "session") {
    const error = new Error(`Order type ${order.type} is not eligible for Divin8 execution.`) as Error & { statusCode?: number };
    error.statusCode = 400;
    throw error;
  }

  return {
    mode: "order",
    user_id: order.user_id,
    order_id: order.id,
    birth_date: order.metadata.birth_date ?? order.metadata.intake.birth_date ?? "",
    birth_time: order.metadata.birth_time ?? order.metadata.intake.birth_time ?? null,
    birth_location: order.metadata.birth_location ?? order.metadata.intake.location ?? "",
    reading_type: order.type === "report" ? mapReadingType(order) : "introductory",
    systems: normalizeSystems(order),
    questions: order.metadata.intake.submitted_questions,
    notes: order.metadata.intake.notes,
    metadata: {
      source_id: order.source_id,
      source_type: order.type,
      client_name: order.client_name,
      email: order.email,
      report_type: order.metadata.report_type,
      report_type_id: order.metadata.report_type_id,
      session_type: order.metadata.session_type,
      full_name: order.client_name,
    },
  };
}
