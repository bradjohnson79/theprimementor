import { CANONICAL_SESSION_OFFERINGS } from "@wisdom/utils";

export type GuidedSessionIntakeType = "qa" | "mentoring" | "star_initiation";
export type GuidedSessionType = "qa_session" | "mentoring" | "star_initiation";

export interface GuidedSessionDurationOption {
  productKey: string;
  bookingTypeId: string;
  minutes: number;
  durationLabel?: string;
  priceCents: number;
  currency: "CAD";
  description: string;
}

export interface GuidedSessionOption {
  intakeType: GuidedSessionIntakeType;
  sessionType: GuidedSessionType;
  label: string;
  tooltip: string;
  description: string;
  durations: GuidedSessionDurationOption[];
}

export const GUIDED_SESSION_BOOKING_PATH = "/sessions/live/book";

const GUIDED_SESSION_COPY: Record<GuidedSessionType, Omit<GuidedSessionOption, "durations">> = {
  qa_session: {
    intakeType: "qa",
    sessionType: "qa_session",
    label: "Q&A Session",
    tooltip:
      "This session allows you to ask any questions you want as you lead the session and receive clarity from Brad Johnson.",
    description:
      "An open, low-friction session for questions, clarity, and direct perspective when you want to lead the conversation.",
  },
  mentoring: {
    intakeType: "mentoring",
    sessionType: "mentoring",
    label: "Mentoring Session",
    tooltip:
      "This session is guided by Brad Johnson as he explores your soul blueprint through the Divin8 system and works as a mentor to help you achieve set goals.",
    description:
      "A deeper guided session for blueprint insight, goal alignment, and practical mentoring through the Divin8 system.",
  },
  star_initiation: {
    intakeType: "star_initiation",
    sessionType: "star_initiation",
    label: "Star Initiation Session",
    tooltip: "A private 20–30 minute Star Initiation with Adronis on Zoom or by phone.",
    description:
      "A private Cosmic Soul Retrieval and personalized Star Initiation hosted by Adronis. Approximately 20–30 minutes on Zoom or by phone.",
  },
};

function getSessionTypeForIntakeType(intakeType: GuidedSessionIntakeType): GuidedSessionType {
  if (intakeType === "qa") return "qa_session";
  if (intakeType === "star_initiation") return "star_initiation";
  return "mentoring";
}

export function getSessionOfferingsByType(intakeType: GuidedSessionIntakeType): GuidedSessionDurationOption[] {
  const sessionType = getSessionTypeForIntakeType(intakeType);
  return CANONICAL_SESSION_OFFERINGS
    .filter((offering) => (
      offering.active
      && offering.intakeFlow === "guided_session"
      && offering.sessionType === sessionType
      && typeof offering.durationMinutes === "number"
    ))
    .map((offering) => ({
      productKey: offering.productKey,
      bookingTypeId: offering.bookingTypeId,
      minutes: offering.durationMinutes ?? 0,
      durationLabel: offering.bookingTypeId === "star-initiation-session" ? "20–30 min" : undefined,
      priceCents: offering.amountCents,
      currency: offering.currency,
      description: offering.description,
    }))
    .sort((left, right) => left.minutes - right.minutes);
}

function buildGuidedSessionOption(sessionType: GuidedSessionType): GuidedSessionOption {
  const intakeType = sessionType === "qa_session" ? "qa" : sessionType === "star_initiation" ? "star_initiation" : "mentoring";
  return {
    ...GUIDED_SESSION_COPY[sessionType],
    durations: getSessionOfferingsByType(intakeType),
  };
}

export const GUIDED_SESSION_OPTIONS: GuidedSessionOption[] = [
  buildGuidedSessionOption("qa_session"),
  buildGuidedSessionOption("mentoring"),
  buildGuidedSessionOption("star_initiation"),
];

export const GUIDED_SESSION_TYPE_OPTIONS = GUIDED_SESSION_OPTIONS.map((option) => ({
  type: option.sessionType,
  label: option.label,
  description: option.description,
}));

export function formatGuidedSessionPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export function formatGuidedSessionDisplayPrice(option: GuidedSessionDurationOption) {
  return `${formatGuidedSessionPrice(option.priceCents, option.currency)} ${option.currency}`;
}

export function getGuidedSessionOption(intakeType: GuidedSessionIntakeType) {
  return GUIDED_SESSION_OPTIONS.find((option) => option.intakeType === intakeType) ?? null;
}

export function getGuidedSessionDuration(bookingTypeId: string) {
  for (const option of GUIDED_SESSION_OPTIONS) {
    const duration = option.durations.find((item) => item.bookingTypeId === bookingTypeId);
    if (duration) {
      return { option, duration };
    }
  }
  return null;
}

export function buildGuidedSessionBookingPath(input: {
  intakeType: GuidedSessionIntakeType;
  minutes: number;
  bookingTypeId: string;
  productKey?: string;
}) {
  const params = new URLSearchParams({
    intakeType: input.intakeType,
    minutes: String(input.minutes),
    bookingTypeId: input.bookingTypeId,
  });
  if (input.productKey) {
    params.set("productKey", input.productKey);
  }
  return `${GUIDED_SESSION_BOOKING_PATH}?${params.toString()}`;
}
