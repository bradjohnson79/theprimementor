export type GuidedSessionIntakeType = "qa" | "mentoring";
export type GuidedSessionType = "qa_session" | "mentoring";

export interface GuidedSessionDurationOption {
  bookingTypeId: string;
  minutes: number;
  priceCents: number;
  currency: "CAD";
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

export const GUIDED_SESSION_OPTIONS: GuidedSessionOption[] = [
  {
    intakeType: "qa",
    sessionType: "qa_session",
    label: "Q&A Session",
    tooltip:
      "This session allows you to ask any questions you want as you lead the session and receive clarity from Brad Johnson.",
    description:
      "An open, low-friction session for questions, clarity, and direct perspective when you want to lead the conversation.",
    durations: [
      { bookingTypeId: "qa-session-30", minutes: 30, priceCents: 14900, currency: "CAD" },
      { bookingTypeId: "qa-session-45", minutes: 45, priceCents: 19900, currency: "CAD" },
      { bookingTypeId: "qa-session-60", minutes: 60, priceCents: 24900, currency: "CAD" },
    ],
  },
  {
    intakeType: "mentoring",
    sessionType: "mentoring",
    label: "Mentoring Session",
    tooltip:
      "This session is guided by Brad Johnson as he explores your soul blueprint through the Divin8 system and works as a mentor to help you achieve set goals.",
    description:
      "A deeper guided session for blueprint insight, goal alignment, and practical mentoring through the Divin8 system.",
    durations: [
      { bookingTypeId: "mentoring-session-45", minutes: 45, priceCents: 19900, currency: "CAD" },
      { bookingTypeId: "wisdom-mentoring-90", minutes: 90, priceCents: 29900, currency: "CAD" },
    ],
  },
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
}) {
  const params = new URLSearchParams({
    intakeType: input.intakeType,
    minutes: String(input.minutes),
    bookingTypeId: input.bookingTypeId,
  });
  return `${GUIDED_SESSION_BOOKING_PATH}?${params.toString()}`;
}
