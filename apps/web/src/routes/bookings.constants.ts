export type SessionType = "focus" | "mentoring" | "regeneration";
export type AvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday";
export type AvailabilitySelection = Record<AvailabilityDay, string[]>;

export const SESSION_TYPE_ORDER: SessionType[] = [
  "regeneration",
  "focus",
  "mentoring",
];

export const AVAILABILITY_DAYS: AvailabilityDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
];

export const AVAILABILITY_DAY_LABELS: Record<AvailabilityDay, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
};

export const AVAILABILITY_SLOTS: Record<AvailabilityDay, string[]> = {
  monday: ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"],
  tuesday: ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"],
  wednesday: ["15:00", "16:00", "17:00"],
  thursday: ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00"],
};

export const SESSION_TYPE_OPTIONS: Array<{
  type: SessionType;
  label: string;
  description: string;
}> = [
  {
    type: "regeneration",
    label: "Regeneration Session",
    description: "An offline regeneration request with no live date or time selection required up front.",
  },
  {
    type: "focus",
    label: "Focus Session",
    description: "A shorter guided session for a specific area of tension, clarity, or decision-making.",
  },
  {
    type: "mentoring",
    label: "Mentoring Session",
    description: "A deeper live session for strategy, alignment, and longer-form support.",
  },
];

export const FOCUS_TOPICS = [
  "Personal conflicts",
  "Physical ailments",
  "Family conflicts",
  "Career",
  "Finance",
  "Relationships",
  "World affairs",
  "Other",
] as const;

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
  };
}

export function sessionTypeRequiresSchedule(sessionType: SessionType) {
  return sessionType !== "regeneration";
}
