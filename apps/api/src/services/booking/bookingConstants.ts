export const BOOKING_SESSION_TYPES = ["focus", "mentoring", "regeneration", "qa_session", "mentoring_circle", "prime_body_healing", "email_session", "past_life_akashic"] as const;
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

export const PRIME_BODY_HEALING_DELIVERY_FORMATS = ["live", "prerecorded", "scan"] as const;
export type PrimeBodyHealingDeliveryFormat = typeof PRIME_BODY_HEALING_DELIVERY_FORMATS[number];

export const PRIME_BODY_HEALING_BOOKING_TYPE_IDS = {
  level1Live: "prime-body-healing-level-1-live",
  level1Prerecorded: "prime-body-healing-level-1-prerecorded",
  level2: "prime-body-healing-level-2",
} as const;

export const OFFLINE_QUESTION_RECIPIENTS = ["brad_johnson", "adronis", "brad_and_adronis"] as const;
export type OfflineQuestionRecipient = typeof OFFLINE_QUESTION_RECIPIENTS[number];

export const OFFLINE_QUESTION_RECIPIENT_LABELS: Record<OfflineQuestionRecipient, string> = {
  brad_johnson: "Brad Johnson",
  adronis: "Adronis",
  brad_and_adronis: "Brad & Adronis",
};

export const EMAIL_SESSION_BOOKING_TYPE_ID = "email-session";
export const PAST_LIFE_AKASHIC_BOOKING_TYPE_ID = "past-life-akashic-reading";
export const OFFLINE_QUESTION_MAX_LENGTH = 1000;
export const OFFLINE_PREPARATORY_NOTE_MAX_LENGTH = 2000;

export interface BookingClientImage {
  id: string;
  fileName: string;
  contentType: string;
}

export interface BookingIntakePayload {
  type: BookingSessionType;
  gender?: BookingClientGender;
  clientImage?: BookingClientImage;
  topics?: string[] | string;
  goals?: string[];
  healthFocusAreas?: BookingHealthFocusArea[];
  manifestationIntention?: string;
  manifestationEnhancement?: BookingManifestationEnhancement;
  deliveryFormat?: PrimeBodyHealingDeliveryFormat;
  healingAreas?: string[];
  concerns?: string;
  birthDate?: string;
  birthTime?: string;
  birthPlace?: string;
  questionRecipient?: OfflineQuestionRecipient;
  question1?: string;
  question2?: string;
  question3?: string;
  preparatoryNote?: string;
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

export function isOfflineRecordedSessionType(sessionType: BookingSessionType) {
  return sessionType === "email_session" || sessionType === "past_life_akashic";
}

export function sessionTypeRequiresSchedule(sessionType: BookingSessionType) {
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session" || sessionType === "regeneration";
}

export function sessionTypeRequiresAvailabilitySelection(sessionType: BookingSessionType) {
  return sessionType === "focus" || sessionType === "mentoring" || sessionType === "qa_session" || sessionType === "regeneration";
}

export function isOfflineQuestionRecipient(value: unknown): value is OfflineQuestionRecipient {
  return typeof value === "string" && OFFLINE_QUESTION_RECIPIENTS.includes(value as OfflineQuestionRecipient);
}

export function isPrimeBodyHealingDeliveryFormat(value: unknown): value is PrimeBodyHealingDeliveryFormat {
  return typeof value === "string" && PRIME_BODY_HEALING_DELIVERY_FORMATS.includes(value as PrimeBodyHealingDeliveryFormat);
}

export function expectedPrimeBodyHealingDeliveryFormat(bookingTypeId: string): PrimeBodyHealingDeliveryFormat | null {
  if (bookingTypeId === PRIME_BODY_HEALING_BOOKING_TYPE_IDS.level1Live) return "live";
  if (bookingTypeId === PRIME_BODY_HEALING_BOOKING_TYPE_IDS.level1Prerecorded) return "prerecorded";
  if (bookingTypeId === PRIME_BODY_HEALING_BOOKING_TYPE_IDS.level2) return "scan";
  return null;
}

export function bookingRequiresNatalFields(sessionType: BookingSessionType, bookingTypeId?: string) {
  if (sessionType === "qa_session" || isOfflineRecordedSessionType(sessionType)) return false;
  if (sessionType === "prime_body_healing") {
    return bookingTypeId === PRIME_BODY_HEALING_BOOKING_TYPE_IDS.level2;
  }
  return true;
}

export function bookingRequiresPhone(sessionType: BookingSessionType) {
  return sessionType !== "qa_session" && sessionType !== "prime_body_healing" && !isOfflineRecordedSessionType(sessionType);
}

function normalizeOfflineText(value: unknown, maxLength: number, label: string) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new Error(`${label} must be ${maxLength} characters or fewer`);
  }
  return trimmed;
}

export function validateEmailSessionIntake(input: {
  questionRecipient: unknown;
  question1: unknown;
  question2: unknown;
  question3: unknown;
}) {
  if (!isOfflineQuestionRecipient(input.questionRecipient)) {
    throw new Error("Choose who should address your questions");
  }
  const question1 = normalizeOfflineText(input.question1, OFFLINE_QUESTION_MAX_LENGTH, "Question 1");
  const question2 = normalizeOfflineText(input.question2, OFFLINE_QUESTION_MAX_LENGTH, "Question 2");
  const question3 = normalizeOfflineText(input.question3, OFFLINE_QUESTION_MAX_LENGTH, "Question 3");
  if (!question1) {
    throw new Error("Question 1 is required");
  }
  return {
    questionRecipient: input.questionRecipient,
    question1,
    question2: question2 || undefined,
    question3: question3 || undefined,
  };
}

export function validatePastLifeAkashicIntake(input: { preparatoryNote: unknown }) {
  const preparatoryNote = normalizeOfflineText(
    input.preparatoryNote,
    OFFLINE_PREPARATORY_NOTE_MAX_LENGTH,
    "Preparatory note",
  );
  return {
    preparatoryNote: preparatoryNote || undefined,
  };
}

export function normalizeHealingAreas(
  value: unknown,
  options: { requireAtLeastOne: boolean; max?: number } = { requireAtLeastOne: false },
): string[] {
  const max = options.max ?? 5;
  const raw = Array.isArray(value) ? value : [];
  const areas = Array.from(
    new Set(
      raw
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean),
    ),
  ).slice(0, max);

  if (options.requireAtLeastOne && areas.length === 0) {
    throw new Error("At least one healing area is required");
  }

  return areas;
}

export function validatePrimeBodyHealingIntake(input: {
  bookingTypeId: string;
  deliveryFormat: unknown;
  healingAreas: unknown;
  concerns: unknown;
}) {
  const expectedFormat = expectedPrimeBodyHealingDeliveryFormat(input.bookingTypeId);
  if (!expectedFormat) {
    throw new Error("Unknown Prime Body Healing booking type");
  }
  if (!isPrimeBodyHealingDeliveryFormat(input.deliveryFormat)) {
    throw new Error("deliveryFormat is required");
  }
  if (input.deliveryFormat !== expectedFormat) {
    throw new Error(`deliveryFormat must be ${expectedFormat} for this booking type`);
  }

  const requireAreas = expectedFormat === "live" || expectedFormat === "prerecorded";
  const healingAreas = normalizeHealingAreas(input.healingAreas, { requireAtLeastOne: requireAreas });
  const concerns = typeof input.concerns === "string" ? input.concerns.trim() : "";

  if (expectedFormat === "scan" && !concerns) {
    throw new Error("concerns are required for Level 2");
  }

  return {
    deliveryFormat: expectedFormat,
    healingAreas,
    concerns: concerns || undefined,
  };
}
