export const BOOKING_SESSION_TYPES = ["focus", "mentoring", "regeneration", "qa_session", "mentoring_circle"] as const;
export type BookingSessionType = typeof BOOKING_SESSION_TYPES[number];

export const BOOKING_STATUSES = ["pending_payment", "paid", "scheduled", "completed", "cancelled"] as const;
export type BookingStatus = typeof BOOKING_STATUSES[number];

export const BOOKING_AVAILABILITY_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const;
export type BookingAvailabilityDay = typeof BOOKING_AVAILABILITY_DAYS[number];

const STANDARD_BOOKING_AVAILABILITY_SLOTS = ["10:00", "11:00", "12:00", "15:00", "16:00", "17:00", "18:00"] as const;

export const BOOKING_AVAILABILITY_SLOTS: Record<BookingAvailabilityDay, readonly string[]> = {
  monday: STANDARD_BOOKING_AVAILABILITY_SLOTS,
  tuesday: STANDARD_BOOKING_AVAILABILITY_SLOTS,
  wednesday: STANDARD_BOOKING_AVAILABILITY_SLOTS,
  thursday: STANDARD_BOOKING_AVAILABILITY_SLOTS,
  friday: STANDARD_BOOKING_AVAILABILITY_SLOTS,
};

export type BookingClientGender = "male" | "female";

export type BookingAvailability = Record<BookingAvailabilityDay, string[]>;
export interface BookingHealthFocusArea {
  name: string;
  severity: number;
}

export interface BookingManifestationEnhancement {
  version: 1;
  selected: boolean;
  intentions?: string;
  priceCents: number;
  currency: "CAD";
}

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

const SESSION_TYPE_SET = new Set<string>(BOOKING_SESSION_TYPES);
const BOOKING_STATUS_SET = new Set<string>(BOOKING_STATUSES);
const BOOKING_AVAILABILITY_DAY_SET = new Set<string>(BOOKING_AVAILABILITY_DAYS);

export interface BookingIntakePayload {
  type: BookingSessionType;
  gender?: BookingClientGender;
  topics?: string[] | string;
  goals?: string[];
  healthFocusAreas?: BookingHealthFocusArea[];
  manifestationIntention?: string;
  manifestationEnhancement?: BookingManifestationEnhancement;
  other?: string;
  notes?: string;
}

export function isBookingSessionType(value: string): value is BookingSessionType {
  return SESSION_TYPE_SET.has(value);
}

export function isBookingStatus(value: string): value is BookingStatus {
  return BOOKING_STATUS_SET.has(value);
}

export function isBookingAvailabilityDay(value: string): value is BookingAvailabilityDay {
  return BOOKING_AVAILABILITY_DAY_SET.has(value);
}

export function createEmptyBookingAvailability(): BookingAvailability {
  return {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
  };
}

export function sessionTypeRequiresSchedule(sessionType: BookingSessionType) {
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session" || sessionType === "regeneration";
}

export function sessionTypeRequiresAvailabilitySelection(sessionType: BookingSessionType) {
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session" || sessionType === "regeneration";
}
