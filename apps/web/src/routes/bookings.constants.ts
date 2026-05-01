export type SessionType = "focus" | "mentoring" | "regeneration" | "qa_session";
export type AvailabilityDay = "monday" | "tuesday" | "wednesday" | "thursday";
export type AvailabilitySelection = Record<AvailabilityDay, string[]>;
export type HealthCondition = {
  name: string;
  severity: number;
};
export const MAX_HEALTH_FOCUS_AREAS = 5;

export const SESSION_TYPE_ORDER: SessionType[] = [
  "regeneration",
  "qa_session",
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
    description:
      "This is an offline session that aligns you into a state of wellness where you feel the effects of previous ailments become released. The Regeneration Session offers a 7 day span of priority email support that helps you to maintain an aligned 'prime' state of being. Custom-made exercises are created based on natal charts through our Divin8 engine designed to help you hold a particular feeling in alignment. Through this feeling and familiarity of it, you remain in a wellness state while shifting yourself into a Delta Brainwave phase. The Regeneration Session transcends healing and moves you into alignment removing old habits and behavioral patterns from your system as you enter a prime state of wellness.",
  },
  {
    type: "qa_session",
    label: "Q&A Session",
    description:
      "The Q&A Session is a 30-minute open interaction designed for clarity, insight, and direct connection. This session gives you the opportunity to ask any questions you have, whether they relate to your current life situation, spiritual direction, or general curiosity. It is also an open space for a personal interaction with Adronis, offering a unique and direct experience for those seeking perspective beyond conventional dialogue. This is not a structured Divin8 reading or mentoring session. Instead, it is designed for flexibility and fast access, allowing you to explore specific questions, gain immediate insight, and connect in a more open and conversational format.",
  },
  {
    type: "focus",
    label: "Focus Session",
    description:
      "A 45 minute interaction where Brad will prepare you for your intended state through a Divin8 Synthesis report. Brad will share insights on your current alignment in life, and how to align your mind's state of being. Whether you're navigating a decision, facing a challenge, or seeking direction, this session isolates the core pattern and brings it into sharp focus. You'll leave with clear, actionable insight and a grounded understanding of your next steps—cutting through confusion and helping you move forward with confidence and intention. The session works to clear stagnation, restore balance, and reconnect you to your natural state of flow—leaving you feeling lighter, clearer, and more internally supported.",
  },
  {
    type: "mentoring",
    label: "Mentoring Session",
    description:
      "A comprehensive session that works across multiple layers of your blueprint to support deeper transformation and long-term growth. This is the most complete session of the 3 as Brad works with you 1 to 1 exploring your natal charts and metaphysical information overview through the Divin8 system. This is where patterns are not just identified—but understood, integrated, and evolved. This session focuses on setting a goal, neutralizing all setbacks towards that goal, and teaching you how to enter Prime Mind: Harmony with your preferred state of being. The Mentoring session is an interaction designed for those ready to go further; this session provides structured guidance, expanded awareness, and aligned direction—supporting real, sustained movement forward on your path.",
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
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session";
}

export function sessionTypeRequiresAvailabilitySelection(sessionType: SessionType) {
  return sessionType === "focus" || sessionType === "mentoring";
}
