export type SessionType = "focus" | "mentoring" | "regeneration" | "qa_session";
export type AvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday";
export type AvailabilitySelection = Record<AvailabilityDay, string[]>;
export type HealthCondition = {
  name: string;
  severity: number;
};
export const MAX_HEALTH_FOCUS_AREAS = 5;

export const SESSION_TYPE_ORDER: SessionType[] = [
  "regeneration",
  "qa_session",
  "mentoring",
];

export const AVAILABILITY_DAYS: AvailabilityDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

export const AVAILABILITY_DAY_LABELS: Record<AvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

const STANDARD_AVAILABILITY_SLOTS = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"];

export const AVAILABILITY_SLOTS: Record<AvailabilityDay, string[]> = {
  monday: STANDARD_AVAILABILITY_SLOTS,
  tuesday: STANDARD_AVAILABILITY_SLOTS,
  wednesday: STANDARD_AVAILABILITY_SLOTS,
  thursday: STANDARD_AVAILABILITY_SLOTS,
  friday: STANDARD_AVAILABILITY_SLOTS,
};

export const SESSION_TYPE_OPTIONS: Array<{
  type: SessionType;
  label: string;
  description: string;
}> = [
  {
    type: "regeneration",
    label: "Regeneration Monthly Package",
    description:
      "A $99 CAD/month subscription with one 15-minute Zoom consultation, safeguarded manifestation work, offline anti-goal clearing, personalized MP3 clearing exercises, and 30-day priority email support. Use it to support health and wellness, finances, career, relationships, household improvement, personal development, selling homes or assets, and custom manifestation requests.",
  },
  {
    type: "qa_session",
    label: "Q&A Session",
    description:
      "The Q&A Session is a 30-minute open interaction designed for clarity, insight, and direct connection. This session gives you the opportunity to ask any questions you have, whether they relate to your current life situation, spiritual direction, or general curiosity. It is also an open space for a personal interaction with Adronis, offering a unique and direct experience for those seeking perspective beyond conventional dialogue. This is not a structured Divin8 reading or mentoring session. Instead, it is designed for flexibility and fast access, allowing you to explore specific questions, gain immediate insight, and connect in a more open and conversational format.",
  },
  {
    type: "mentoring",
    label: "Mentoring Session",
    description:
      "A comprehensive session that works across multiple layers of your blueprint to support deeper transformation and long-term growth. This is the most complete session of the 3 as Brad works with you 1 to 1 exploring your natal charts and metaphysical information overview through the Divin8 system. This is where patterns are not just identified—but understood, integrated, and evolved. This session focuses on setting a goal, neutralizing all setbacks towards that goal, and teaching you how to enter Prime Mind: Harmony with your preferred state of being. The Mentoring session is an interaction designed for those ready to go further; this session provides structured guidance, expanded awareness, and aligned direction—supporting real, sustained movement forward on your path.",
  },
];

export const MENTORING_GOALS = [
  "Starting a business",
  "Improving a business",
  "Financial improvement",
  "Personal Development",
  "Improving Family Connections",
  "Building Relationships",
  "Other",
] as const;

export function createEmptyAvailabilitySelection(): AvailabilitySelection {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };
}

export function sessionTypeRequiresSchedule(sessionType: SessionType) {
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session";
}

export function sessionTypeRequiresAvailabilitySelection(sessionType: SessionType) {
  return sessionType === "qa_session" || sessionType === "mentoring" || sessionType === "regeneration";
}
