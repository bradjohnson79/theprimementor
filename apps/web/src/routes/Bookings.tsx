import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { useLocation } from "react-router-dom";
import { getSuggestedTimezone } from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import FormField from "../components/forms/FormField";
import FormStepper, { type StepConfig } from "../components/forms/FormStepper";
import ReviewStep from "../components/forms/ReviewStep";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";
import { api } from "../lib/api";
import { trackEventOnce } from "../lib/analytics";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import {
  createValidationResult,
  requiredStepMessage,
  type ValidationErrors,
} from "../lib/forms/validationEngine";
import {
  FOCUS_LANDING_PATH,
  MENTORING_LANDING_PATH,
  REGENERATION_LANDING_PATH,
} from "../lib/sessionLandingPaths";
import { startSessionCheckout } from "../lib/sessionCheckout";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_SLOTS,
  FOCUS_TOPICS,
  MAX_HEALTH_FOCUS_AREAS,
  MENTORING_GOALS,
  SESSION_TYPE_OPTIONS,
  SESSION_TYPE_ORDER,
  createEmptyAvailabilitySelection,
  sessionTypeRequiresSchedule,
  type AvailabilityDay,
  type AvailabilitySelection,
  type HealthCondition,
  type SessionType,
} from "./bookings.constants";

interface BookingType {
  id: string;
  name: string;
  session_type: SessionType;
  duration_minutes: number;
  price_cents: number;
  currency: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
}

interface CreateBookingResponse {
  success?: boolean;
  bookingId?: string;
  requiresPayment?: boolean;
}

const SESSION_CARD_PRICE_OVERRIDES: Partial<Record<SessionType, number>> = {
  regeneration: 9900,
  focus: 19900,
};

interface IntakeFormState {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  additionalNotes: string;
  focusTopics: string[];
  healthFocusAreas: Array<{ name: string; severity: string }>;
  mentoringTopics: string[];
  otherDetail: string;
  consentGiven: boolean;
}

function createEmptyHealthFocusAreas() {
  return Array.from({ length: MAX_HEALTH_FOCUS_AREAS }, () => ({ name: "", severity: "" }));
}

function buildInitialFormState(prefill?: Partial<IntakeFormState>): IntakeFormState {
  return {
    fullName: prefill?.fullName ?? "",
    email: prefill?.email ?? "",
    phone: "",
    birthDate: "",
    birthTime: "00:00",
    birthPlace: "",
    additionalNotes: "",
    focusTopics: [],
    healthFocusAreas: createEmptyHealthFocusAreas(),
    mentoringTopics: [],
    otherDetail: "",
    consentGiven: false,
  };
}

function normalizeText(value: string) {
  return value.trim();
}

function resolveBirthTimeInput(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 5) : "00:00";
}

function resolveSessionTypeFromPath(pathname: string): SessionType | null {
  if (pathname.includes(FOCUS_LANDING_PATH)) return "focus";
  if (pathname.includes(REGENERATION_LANDING_PATH)) return "regeneration";
  if (pathname.includes(MENTORING_LANDING_PATH)) return "mentoring";
  return null;
}

function formatAvailabilityTime(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(Date.UTC(2000, 0, 1, hours, minutes));
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function formatSessionPrice(priceCents: number, currency: string) {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency,
  }).format(priceCents / 100);
}

function resolveSessionCardPrice(sessionType: SessionType, bookingType: BookingType | null) {
  const overriddenPrice = SESSION_CARD_PRICE_OVERRIDES[sessionType];
  if (typeof overriddenPrice === "number") {
    return formatSessionPrice(overriddenPrice, bookingType?.currency ?? "CAD");
  }

  if (!bookingType) {
    return null;
  }

  return formatSessionPrice(bookingType.price_cents, bookingType.currency);
}

function formatSessionDuration(sessionType: SessionType, durationMinutes: number | null) {
  if (sessionType === "regeneration") {
    return "Offline";
  }
  if (!durationMinutes) {
    return null;
  }
  return `${durationMinutes} mins`;
}

function countSelectedAvailability(selection: AvailabilitySelection) {
  return AVAILABILITY_DAYS.reduce((count, day) => count + selection[day].length, 0);
}

function hasSelectedAvailability(selection: AvailabilitySelection) {
  return countSelectedAvailability(selection) > 0;
}

function normalizeHealthFocusAreas(
  areas: IntakeFormState["healthFocusAreas"],
): HealthCondition[] {
  return areas
    .map((area) => ({
      name: normalizeText(area.name),
      severity: Number(area.severity),
    }))
    .filter((area) => area.name)
    .map((area) => ({
      name: area.name,
      severity: area.severity,
    }))
    .filter((area) => Number.isInteger(area.severity));
}

export default function Bookings() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser } = useCurrentUser();
  const location = useLocation();
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType | null>(null);
  const [timezone, setTimezone] = useState("");
  const [timezoneSource, setTimezoneSource] = useState<"user" | "suggested" | "fallback">("user");
  const [availabilitySelection, setAvailabilitySelection] = useState<AvailabilitySelection>(createEmptyAvailabilitySelection);
  const [form, setForm] = useState<IntakeFormState>(() => buildInitialFormState());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [birthTimeEdited, setBirthTimeEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [birthplace, setBirthplace] = useState<PlaceResult | null>(null);
  const {
    error: placesError,
    isResolving: resolvingPlace,
    isSearching: searchingPlaces,
    suggestions: placeSuggestions,
    selectSuggestion,
  } = useGooglePlaces(form.birthPlace, (place) => {
    setBirthplace(place);
    setForm((current) => ({ ...current, birthPlace: place.name }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.birthPlace;
      return next;
    });
  });

  const availableTypes = useMemo(
    () => new Set(bookingTypes.map((item) => item.session_type)),
    [bookingTypes],
  );

  const selectedBookingType = useMemo(
    () => bookingTypes.find((item) => item.session_type === selectedSessionType) ?? null,
    [bookingTypes, selectedSessionType],
  );

  const availabilitySummary = useMemo(
    () =>
      AVAILABILITY_DAYS.filter((day) => availabilitySelection[day].length > 0).map((day) => ({
        day,
        label: AVAILABILITY_DAY_LABELS[day],
        times: availabilitySelection[day].map(formatAvailabilityTime),
      })),
    [availabilitySelection],
  );

  const isPlaceSelected = Boolean(
    birthplace
      && birthplace.name === form.birthPlace
      && Number.isFinite(birthplace.lat)
      && Number.isFinite(birthplace.lng),
  );

  const requiresSchedule = selectedSessionType ? sessionTypeRequiresSchedule(selectedSessionType) : false;
  const isRegeneration = selectedSessionType === "regeneration";
  const suggestedTimezone = useMemo(
    () =>
      getSuggestedTimezone({
        latitude: birthplace?.lat,
        longitude: birthplace?.lng,
        timezone: birthplace?.timezone,
      }),
    [birthplace?.lat, birthplace?.lng, birthplace?.timezone],
  );

  useEffect(() => {
    const email = dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
    const fullName = clerkUser?.fullName || "";
    setForm((current) => ({
      ...current,
      email: current.email || email,
      fullName: current.fullName || fullName,
    }));
  }, [clerkUser?.fullName, clerkUser?.primaryEmailAddress?.emailAddress, dbUser?.email]);

  useEffect(() => {
    setSelectedSessionType(resolveSessionTypeFromPath(location.pathname));
    setError(null);
    setPurchaseError(null);
    setSuccess(null);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function reconcileCheckoutState() {
      const params = new URLSearchParams(location.search);
      const checkoutState = params.get("checkout");
      const bookingId = params.get("bookingId");
      const checkoutSessionId = params.get("checkoutSessionId");

      if (checkoutState === "success") {
        setError(null);
        setPurchaseError(null);

        try {
          const token = await getToken();
          await syncOwnedCheckoutSession({
            token,
            checkoutSessionId,
            entityType: bookingId ? "session" : undefined,
            entityId: bookingId,
          });
        } catch (err) {
          if (!cancelled) {
            setPurchaseError(err instanceof Error ? err.message : "Payment completed, but booking confirmation is still syncing.");
          }
        }

        if (!cancelled) {
          setSuccess("Payment received. Your booking is confirmed and will now move into the scheduling flow.");
          trackEventOnce(`analytics:booking:${bookingId ?? "success"}`, "purchase", {
            source: "session_checkout_success",
            productType: "session",
            sessionType: selectedSessionType ?? "unknown",
          });
        }
        return;
      }

      if (checkoutState === "canceled" && !cancelled) {
        setSuccess(null);
        setPurchaseError("Checkout was canceled. Your pending booking was kept, so you can try again when you're ready.");
      }
    }

    void reconcileCheckoutState();
    return () => {
      cancelled = true;
    };
  }, [getToken, location.search, selectedSessionType]);

  useEffect(() => {
    async function loadBookingTypes() {
      setLoadingTypes(true);
      try {
        const token = await getToken();
        const response = (await api.get("/booking-types", token)) as { data: BookingType[] };
        const ordered = [...response.data].sort(
          (left, right) => SESSION_TYPE_ORDER.indexOf(left.session_type) - SESSION_TYPE_ORDER.indexOf(right.session_type),
        );
        setBookingTypes(ordered);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load booking options.");
      } finally {
        setLoadingTypes(false);
      }
    }

    void loadBookingTypes();
  }, [getToken]);

  useEffect(() => {
    setAvailabilitySelection(createEmptyAvailabilitySelection());
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.availability;
      delete next.focusTopics;
      delete next.healthFocusAreas;
      delete next.mentoringTopics;
      delete next.otherDetail;
      return next;
    });
    setForm((current) => ({
      ...current,
      focusTopics: [],
      healthFocusAreas: createEmptyHealthFocusAreas(),
      mentoringTopics: [],
      otherDetail: "",
    }));
    setBirthplace(null);
    setTimezone("");
    setTimezoneSource("user");
    setBirthTimeEdited(false);
  }, [selectedSessionType]);

  function setFormField<K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function toggleFocusTopic(topic: string) {
    setForm((current) => {
      const hasTopic = current.focusTopics.includes(topic);
      const focusTopics = hasTopic ? [] : [topic];
      return {
        ...current,
        focusTopics,
        otherDetail: topic === "Other" && hasTopic ? "" : current.otherDetail,
      };
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.focusTopics;
      delete next.otherDetail;
      return next;
    });
  }

  function toggleMentoringTopic(topic: string) {
    setForm((current) => {
      const hasTopic = current.mentoringTopics.includes(topic);
      const mentoringTopics = hasTopic
        ? current.mentoringTopics.filter((item) => item !== topic)
        : current.mentoringTopics.length >= 3
          ? current.mentoringTopics
          : [...current.mentoringTopics, topic];

      return {
        ...current,
        mentoringTopics,
        otherDetail: topic === "Other" && hasTopic ? "" : current.otherDetail,
      };
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.mentoringTopics;
      delete next.otherDetail;
      return next;
    });
  }

  function toggleAvailability(day: AvailabilityDay, time: string) {
    setAvailabilitySelection((current) => {
      const selected = current[day].includes(time);
      const nextDaySelection = selected
        ? current[day].filter((slot) => slot !== time)
        : [...current[day], time];

      return {
        ...current,
        [day]: AVAILABILITY_SLOTS[day].filter((slot) => nextDaySelection.includes(slot)),
      };
    });
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.availability;
      return next;
    });
  }

  function updateHealthCondition(index: number, patch: Partial<IntakeFormState["healthFocusAreas"][number]>) {
    setForm((current) => ({
      ...current,
      healthFocusAreas: current.healthFocusAreas.map((area, currentIndex) => (
        currentIndex === index ? { ...area, ...patch } : area
      )),
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.healthFocusAreas;
      return next;
    });
  }

  function validateForm() {
    const nextErrors: Record<string, string> = {};

    if (!selectedSessionType) {
      nextErrors.sessionType = "Choose a session type.";
    }
    if (!selectedBookingType) {
      nextErrors.sessionType = "This session type is not available yet.";
    }
    if (!timezone) {
      nextErrors.timezone = "A valid timezone is required.";
    }
    if (requiresSchedule && !hasSelectedAvailability(availabilitySelection)) {
      nextErrors.availability = "Select at least one availability slot.";
    }

    if (!normalizeText(form.fullName)) nextErrors.fullName = "Full name is required.";
    if (!normalizeText(form.email)) nextErrors.email = "Email is required.";
    if (!normalizeText(form.phone)) nextErrors.phone = "Phone number is required.";
    if (!normalizeText(form.birthDate)) nextErrors.birthDate = "Birthdate is required.";
    if (!isPlaceSelected) nextErrors.birthPlace = "Please select a valid birthplace from the dropdown.";
    if (!form.consentGiven) nextErrors.consentGiven = "Consent is required.";

    if (selectedSessionType === "focus" && form.focusTopics.length === 0) {
      nextErrors.focusTopics = "Select at least one topic.";
    }

    if (selectedSessionType === "mentoring" && form.mentoringTopics.length === 0) {
      nextErrors.mentoringTopics = "Select at least one topic.";
    }

    if (selectedSessionType === "regeneration") {
      const namedAreas = form.healthFocusAreas.filter((area) => normalizeText(area.name));
      if (namedAreas.length === 0) {
        nextErrors.healthFocusAreas = "Please enter at least one health focus area.";
      } else if (namedAreas.some((area) => {
        const severity = Number(area.severity);
        return !Number.isInteger(severity) || severity < 1 || severity > 10;
      })) {
        nextErrors.healthFocusAreas = "Each health focus area needs a severity from 1 to 10.";
      }
    }

    const needsOtherDetail = (selectedSessionType === "focus" && form.focusTopics.includes("Other"))
      || (selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other"));
    if (needsOtherDetail && !normalizeText(form.otherDetail)) {
      nextErrors.otherDetail = "Tell us what “Other” means for you.";
    }

    return nextErrors;
  }

  function buildBookingPayload(place: PlaceResult) {
    const intake: Record<string, unknown> = {
      type: selectedSessionType,
      notes: normalizeText(form.additionalNotes) || undefined,
    };

    if (selectedSessionType === "focus") {
      intake.topics = form.focusTopics;
    }

    if (selectedSessionType === "mentoring") {
      intake.goals = form.mentoringTopics;
    }

    if (selectedSessionType === "regeneration") {
      intake.healthFocusAreas = normalizeHealthFocusAreas(form.healthFocusAreas);
    }

    if (normalizeText(form.otherDetail)) {
      intake.other = normalizeText(form.otherDetail);
    }

    return {
      bookingTypeId: selectedBookingType?.id,
      sessionType: selectedSessionType,
      availability: requiresSchedule ? availabilitySelection : undefined,
      timezone,
      fullName: normalizeText(form.fullName),
      email: normalizeText(form.email),
      phone: normalizeText(form.phone),
      birthDate: form.birthDate,
      birthTime: resolveBirthTimeInput(form.birthTime),
      birthPlace: normalizeText(form.birthPlace),
      birthPlaceName: place.name,
      birthLat: place.lat,
      birthLng: place.lng,
      birthTimezone: timezone || undefined,
      timezoneSource,
      consentGiven: form.consentGiven,
      intake,
      notes: normalizeText(form.additionalNotes) || undefined,
    };
  }

  async function handlePurchase() {
    setError(null);
    setPurchaseError(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !selectedSessionType || !selectedBookingType || !birthplace) {
      return;
    }

    setIsProcessing(true);
    try {
      const token = await getToken();
      const bookingResponse = (await api.post(
        "/bookings",
        buildBookingPayload(birthplace),
        token,
      )) as CreateBookingResponse;

      if (!bookingResponse.success || !bookingResponse.bookingId || bookingResponse.requiresPayment !== true) {
        throw new Error("Booking response was missing required payment information.");
      }

      trackEventOnce(`analytics:session-booked:${bookingResponse.bookingId}`, "session_booked", {
        source: "sessions_checkout_create",
        sessionType: selectedSessionType,
        bookingId: bookingResponse.bookingId,
      });

      try {
        await startSessionCheckout(bookingResponse.bookingId, { token });
      } catch {
        setPurchaseError("Something went wrong. Please try again.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start your session purchase.");
    } finally {
      setIsProcessing(false);
    }
  }

  const fieldClassName =
    "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 pr-10 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  function setSingleFieldError(field: string, message?: string) {
    setFieldErrors((current) => {
      const next = { ...current };
      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }
      return next;
    });
  }

  function validateSessionChoiceStep() {
    const nextErrors: ValidationErrors = {};
    if (!selectedSessionType) {
      nextErrors.sessionType = "Choose the session you want, then we'll guide you through the rest.";
    } else if (!selectedBookingType) {
      nextErrors.sessionType = "That session isn't available just yet. Please choose another option.";
    }
    return createValidationResult(nextErrors);
  }

  function validateBasicInfoStep() {
    const nextErrors: ValidationErrors = {};
    if (!normalizeText(form.fullName)) nextErrors.fullName = requiredStepMessage("Your full name");
    if (!normalizeText(form.email)) nextErrors.email = requiredStepMessage("Your email");
    if (!normalizeText(form.phone)) nextErrors.phone = requiredStepMessage("Your phone number");
    return createValidationResult(nextErrors);
  }

  function validateBirthDetailsStep() {
    const nextErrors: ValidationErrors = {};
    if (!normalizeText(form.birthDate)) nextErrors.birthDate = requiredStepMessage("Your birth date");
    if (!isPlaceSelected) nextErrors.birthPlace = "Please choose your birthplace from the list so we can keep the details precise.";
    if (!timezone) nextErrors.timezone = requiredStepMessage("Your timezone");
    return createValidationResult(nextErrors);
  }

  function validateAvailabilityStep() {
    const nextErrors: ValidationErrors = {};
    if (requiresSchedule && !hasSelectedAvailability(availabilitySelection)) {
      nextErrors.availability = "Just one more step here before we continue. Pick at least one time that works for you.";
    }
    return createValidationResult(nextErrors);
  }

  function validateIntentStep() {
    const nextErrors: ValidationErrors = {};

    if (selectedSessionType === "focus" && form.focusTopics.length === 0) {
      nextErrors.focusTopics = "Choose the area you'd like this session to focus on.";
    }

    if (selectedSessionType === "mentoring" && form.mentoringTopics.length === 0) {
      nextErrors.mentoringTopics = "Choose at least one mentoring topic so we can tune in properly.";
    }

    if (selectedSessionType === "regeneration") {
      const namedAreas = form.healthFocusAreas.filter((area) => normalizeText(area.name));
      if (namedAreas.length === 0) {
        nextErrors.healthFocusAreas = "Add at least one health focus area so we know where to begin.";
      } else if (namedAreas.some((area) => {
        const severity = Number(area.severity);
        return !Number.isInteger(severity) || severity < 1 || severity > 10;
      })) {
        nextErrors.healthFocusAreas = "Each health focus area needs a severity between 1 and 10 before we continue.";
      }
    }

    const needsOtherDetail = (selectedSessionType === "focus" && form.focusTopics.includes("Other"))
      || (selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other"));
    if (needsOtherDetail && !normalizeText(form.otherDetail)) {
      nextErrors.otherDetail = "Tell us a little more about what 'Other' means for you.";
    }

    return createValidationResult(nextErrors);
  }

  function validateOptionalStep() {
    return createValidationResult();
  }

  function validateReviewStep() {
    const nextErrors: ValidationErrors = {};
    if (!form.consentGiven) {
      nextErrors.consentGiven = "Please confirm these details so we can move forward with your session.";
    }
    return createValidationResult(nextErrors);
  }

  function handleFieldBlur(field: "fullName" | "email" | "phone" | "birthDate" | "birthPlace" | "timezone" | "otherDetail") {
    const validators: Record<typeof field, () => string | undefined> = {
      fullName: () => (normalizeText(form.fullName) ? undefined : requiredStepMessage("Your full name")),
      email: () => (normalizeText(form.email) ? undefined : requiredStepMessage("Your email")),
      phone: () => (normalizeText(form.phone) ? undefined : requiredStepMessage("Your phone number")),
      birthDate: () => (normalizeText(form.birthDate) ? undefined : requiredStepMessage("Your birth date")),
      birthPlace: () => (isPlaceSelected ? undefined : "Please choose your birthplace from the list so we can keep the details precise."),
      timezone: () => (timezone ? undefined : requiredStepMessage("Your timezone")),
      otherDetail: () => {
        const needsOtherDetail = (selectedSessionType === "focus" && form.focusTopics.includes("Other"))
          || (selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other"));
        return !needsOtherDetail || normalizeText(form.otherDetail)
          ? undefined
          : "Tell us a little more about what 'Other' means for you.";
      },
    };

    setSingleFieldError(field, validators[field]());
  }

  const reviewSections = useMemo(() => {
    const sections = [
      {
        id: "session-choice",
        title: "Session Choice",
        items: [
          { label: "Session", value: SESSION_TYPE_OPTIONS.find((option) => option.type === selectedSessionType)?.label ?? "Not selected yet" },
          { label: "Pricing", value: selectedSessionType ? resolveSessionCardPrice(selectedSessionType, selectedBookingType) ?? "Available after selection" : "Available after selection" },
        ],
      },
      {
        id: "basic-info",
        title: "Basic Info",
        items: [
          { label: "Full Name", value: form.fullName || "Not provided yet" },
          { label: "Email", value: form.email || "Not provided yet" },
          { label: "Phone", value: form.phone || "Not provided yet" },
        ],
      },
      {
        id: "birth-details",
        title: "Birth Details",
        items: [
          { label: "Birth Date", value: form.birthDate || "Not provided yet" },
          { label: "Birth Time", value: form.birthTime || "12:00 AM" },
          { label: "Birthplace", value: form.birthPlace || "Not provided yet" },
          { label: "Timezone", value: timezone || "Not selected yet" },
        ],
      },
    ];

    if (requiresSchedule) {
      sections.push({
        id: "availability",
        title: "Availability",
        items: [
          {
            label: "Selected Times",
            value: availabilitySummary.length > 0
              ? availabilitySummary.map((entry) => `${entry.label}: ${entry.times.join(", ")}`).join(" | ")
              : "No availability selected yet",
          },
        ],
      });
    }

    sections.push({
      id: "intent",
      title: "Session Intent",
      items: [
        {
          label: "Focus",
          value:
            selectedSessionType === "focus"
              ? (form.focusTopics.join(", ") || "Not selected yet")
              : selectedSessionType === "mentoring"
                ? (form.mentoringTopics.join(", ") || "Not selected yet")
                : normalizeHealthFocusAreas(form.healthFocusAreas).map((area) => `${area.name} (${area.severity}/10)`).join(", ") || "Not added yet",
        },
        {
          label: "Other Detail",
          value: normalizeText(form.otherDetail) || "None added",
        },
      ],
    });

    sections.push({
      id: "optional",
      title: "Optional Inputs",
      items: [
        { label: "Additional Notes", value: normalizeText(form.additionalNotes) || "None added" },
        { label: "Consent", value: form.consentGiven ? "Confirmed" : "Please confirm before purchase" },
      ],
    });

    return sections;
  }, [
    availabilitySummary,
    form.additionalNotes,
    form.birthDate,
    form.birthPlace,
    form.birthTime,
    form.consentGiven,
    form.email,
    form.focusTopics,
    form.fullName,
    form.healthFocusAreas,
    form.mentoringTopics,
    form.otherDetail,
    form.phone,
    requiresSchedule,
    selectedBookingType,
    selectedSessionType,
    timezone,
  ]);

  const steps = useMemo<StepConfig<IntakeFormState>[]>(() => {
    const nextSteps: StepConfig<IntakeFormState>[] = [
      {
        id: "session-choice",
        title: "Choose your session",
        guidance: "Start here. Pick the session that fits what you need right now, and we'll guide the rest from there.",
        validate: validateSessionChoiceStep,
        isComplete: () => Boolean(selectedSessionType && selectedBookingType),
        render: () => (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-white/60">Only one session is selected at a time so the flow stays calm and clear.</p>
              {loadingTypes ? <span className="text-xs text-white/45">Loading options...</span> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {SESSION_TYPE_OPTIONS.map((option) => {
                const isAvailable = availableTypes.has(option.type);
                const isActive = selectedSessionType === option.type;
                const bookingTypeForCard = bookingTypes.find((item) => item.session_type === option.type) ?? null;
                const priceLabel = resolveSessionCardPrice(option.type, bookingTypeForCard);
                const durationLabel = formatSessionDuration(option.type, bookingTypeForCard?.duration_minutes ?? null);
                return (
                  <motion.button
                    key={option.type}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedSessionType(option.type);
                      setError(null);
                      setSuccess(null);
                      setSingleFieldError("sessionType");
                    }}
                    whileTap={isAvailable ? { scale: 0.99 } : undefined}
                    animate={isActive ? { scale: 1.03 } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-amber-300/60 bg-accent-cyan/10 text-white shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                        : "border-white/10 bg-white/5 text-white hover:border-white/25"
                    } ${!isAvailable ? "cursor-not-allowed opacity-50" : ""}`}
                  >
                    {isActive ? (
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_60%)]" />
                    ) : null}
                    <div className="relative">
                      <div className="text-base font-semibold">{option.label}</div>
                      {priceLabel || durationLabel ? (
                        <p className="mt-2 min-h-[1.25rem] text-sm font-medium text-amber-200/90">
                          {[priceLabel, durationLabel].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-2 flex-1 text-sm leading-6 text-white/60">{option.description}</p>
                      <div className="mt-4 min-h-[1rem]">
                        {!isAvailable ? <p className="text-xs text-white/40">Not available yet</p> : null}
                      </div>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            {selectedSessionType ? (
              <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-4 py-4 text-sm text-cyan-100">
                Great choice. Let's get this set up for you.
              </div>
            ) : null}

            {fieldErrors.sessionType ? <p className="text-sm text-amber-200">{fieldErrors.sessionType}</p> : null}
          </div>
        ),
      },
      {
        id: "basic-info",
        title: "Basic info",
        guidance: "Tell us who this session is for. Keeping this section simple helps everything feel more effortless.",
        validate: validateBasicInfoStep,
        isComplete: (state) => Boolean(normalizeText(state.fullName) && normalizeText(state.email) && normalizeText(state.phone)),
        render: () => (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Full Name"
              htmlFor="session-full-name"
              helperText="Enter the full name you'd like associated with the session."
              errorText={fieldErrors.fullName}
              isComplete={Boolean(normalizeText(form.fullName))}
            >
              <input
                id="session-full-name"
                className={fieldClassName}
                value={form.fullName}
                onChange={(event) => setFormField("fullName", event.target.value)}
                onBlur={() => handleFieldBlur("fullName")}
                placeholder="Your full name"
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="session-email"
              helperText="We'll use the email on your account for updates and confirmations."
              errorText={fieldErrors.email}
              isComplete={Boolean(normalizeText(form.email))}
            >
              <input
                id="session-email"
                className={fieldClassName}
                type="email"
                value={form.email}
                readOnly
                onBlur={() => handleFieldBlur("email")}
              />
            </FormField>

            <FormField
              label="Phone Number"
              htmlFor="session-phone"
              helperText="This helps us reach you if we need to confirm scheduling details."
              errorText={fieldErrors.phone}
              isComplete={Boolean(normalizeText(form.phone))}
              className="md:col-span-2"
            >
              <input
                id="session-phone"
                className={fieldClassName}
                value={form.phone}
                onChange={(event) => setFormField("phone", event.target.value)}
                onBlur={() => handleFieldBlur("phone")}
                placeholder="Your phone number"
              />
            </FormField>
          </div>
        ),
      },
      {
        id: "birth-details",
        title: "Birth details",
        guidance: "Enter your birth details. If you're unsure of your birth time, you can leave the default in place and continue.",
        validate: validateBirthDetailsStep,
        isComplete: () => Boolean(normalizeText(form.birthDate) && isPlaceSelected && timezone),
        render: () => (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Birthdate"
                htmlFor="session-birth-date"
                helperText="This anchors the session to your core timing."
                errorText={fieldErrors.birthDate}
                isComplete={Boolean(normalizeText(form.birthDate))}
              >
                <input
                  id="session-birth-date"
                  className={fieldClassName}
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setFormField("birthDate", event.target.value)}
                  onBlur={() => handleFieldBlur("birthDate")}
                />
              </FormField>

              <FormField
                label="Birthtime"
                htmlFor="session-birth-time"
                helperText="Do you know your birth time? If not, you can leave this as is and continue."
                focusedHelperText="Adding your birth time allows for a more precise reading, but it's not required."
                optional
                isComplete={birthTimeEdited && Boolean(normalizeText(form.birthTime))}
                interacted={birthTimeEdited}
                successText="Perfect, that helps refine your reading."
                successTone="neutral"
                showSuccessIcon={false}
              >
                <input
                  id="session-birth-time"
                  className={fieldClassName}
                  type="time"
                  value={form.birthTime}
                  onChange={(event) => {
                    setBirthTimeEdited(true);
                    setFormField("birthTime", event.target.value);
                  }}
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Birthplace"
                htmlFor="session-birth-place"
                helperText="Start typing and choose your birthplace from the list."
                errorText={placesError || fieldErrors.birthPlace}
                isComplete={isPlaceSelected}
              >
                <div>
                  <input
                    id="session-birth-place"
                    className={fieldClassName}
                    value={form.birthPlace}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFormField("birthPlace", value);
                      if (!birthplace || value !== birthplace.name) {
                        setBirthplace(null);
                      }
                    }}
                    onBlur={() => handleFieldBlur("birthPlace")}
                    placeholder="Start typing and select your birthplace"
                    autoComplete="off"
                  />
                  {placeSuggestions.length > 0 ? (
                    <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95">
                      {placeSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.placeId}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => void selectSuggestion(suggestion)}
                          className="block w-full border-b border-white/5 px-4 py-3 text-left text-sm text-white/75 transition last:border-b-0 hover:bg-white/5 hover:text-white"
                        >
                          <span className="block font-medium text-white">{suggestion.primaryText}</span>
                          {suggestion.secondaryText ? (
                            <span className="mt-1 block text-xs text-white/45">{suggestion.secondaryText}</span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {searchingPlaces ? <span className="mt-2 block text-xs text-white/45">Searching places...</span> : null}
                  {resolvingPlace ? <span className="mt-2 block text-xs text-white/45">Loading place details...</span> : null}
                  {isPlaceSelected ? (
                    <span className="mt-2 block text-xs text-emerald-200/90">
                      Confirmed for Swiss Ephemeris: latitude {birthplace!.lat.toFixed(4)}, longitude {birthplace!.lng.toFixed(4)}.
                    </span>
                  ) : null}
                </div>
              </FormField>

              <FormField
                label="Timezone"
                helperText="Choose your timezone (look for your UTC/GMT offset if you're unsure)."
                errorText={fieldErrors.timezone}
                isComplete={Boolean(timezone)}
              >
                <div>
                  <TimezoneSelect
                    value={timezone}
                    onChange={(value) => {
                      setTimezone(value);
                      setTimezoneSource("user");
                      setSingleFieldError("timezone");
                    }}
                    required
                    className={fieldClassName}
                  />
                  {suggestedTimezone ? (
                    <span className="mt-2 block text-xs text-white/45">
                      Suggested timezone: <span className="text-white/75">{suggestedTimezone}</span>{" "}
                      <button
                        type="button"
                        onClick={() => {
                          setTimezone(suggestedTimezone);
                          setTimezoneSource("suggested");
                          setSingleFieldError("timezone");
                        }}
                        className="text-accent-cyan transition hover:text-accent-cyan/80"
                      >
                        Use this
                      </button>
                    </span>
                  ) : null}
                </div>
              </FormField>
            </div>
          </div>
        ),
      },
    ];

    if (requiresSchedule) {
      nextSteps.push({
        id: "availability",
        title: "Availability",
        guidance: `Share the times that feel realistic for you. This helps us personally schedule your ${selectedSessionType === "focus" ? "focus" : "mentoring"} session without any rush.`,
        validate: validateAvailabilityStep,
        isComplete: () => hasSelectedAvailability(availabilitySelection),
        render: () => (
          <div className="space-y-5">
            <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/85">
              <p>Please select your availability below.</p>
              <p className="mt-2 text-white/65">
                This does not confirm a specific booking time. Your session will be personally scheduled based on what you select here.
              </p>
            </div>

            <div className="space-y-5">
              {AVAILABILITY_DAYS.map((day) => (
                <div key={day} className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-white/55">
                      {AVAILABILITY_DAY_LABELS[day]}
                    </h3>
                    {availabilitySelection[day].length > 0 ? (
                      <span className="rounded-full border border-accent-cyan/30 bg-accent-cyan/10 px-3 py-1 text-xs text-accent-cyan">
                        {availabilitySelection[day].length} selected
                      </span>
                    ) : null}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {AVAILABILITY_SLOTS[day].map((time) => {
                      const active = availabilitySelection[day].includes(time);
                      return (
                        <button
                          key={`${day}-${time}`}
                          type="button"
                          onClick={() => toggleAvailability(day, time)}
                          className={`rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active
                              ? "border-accent-cyan/60 bg-accent-cyan/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          <span className="font-medium">{formatAvailabilityTime(time)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {fieldErrors.availability ? <p className="text-sm text-amber-200">{fieldErrors.availability}</p> : null}
          </div>
        ),
      });
    }

    nextSteps.push(
      {
        id: "intent",
        title: selectedSessionType === "regeneration" ? "Health focus" : "Session intent",
        guidance:
          selectedSessionType === "regeneration"
            ? "Tell us where you'd like support. This gives us a grounded starting point before your regeneration work begins."
            : "This helps us better tune into your situation and guide the session with precision.",
        validate: validateIntentStep,
        isComplete: () => {
          if (selectedSessionType === "focus") return form.focusTopics.length > 0 && (!form.focusTopics.includes("Other") || Boolean(normalizeText(form.otherDetail)));
          if (selectedSessionType === "mentoring") return form.mentoringTopics.length > 0 && (!form.mentoringTopics.includes("Other") || Boolean(normalizeText(form.otherDetail)));
          return normalizeHealthFocusAreas(form.healthFocusAreas).length > 0;
        },
        render: () => (
          <div className="space-y-4">
            {selectedSessionType === "focus" ? (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/70">Topics</p>
                  <span className="text-xs text-white/45">Select 1 topic maximum.</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {FOCUS_TOPICS.map((topic) => {
                    const active = form.focusTopics.includes(topic);
                    return (
                      <label
                        key={topic}
                        className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          active
                            ? "border-accent-cyan/60 bg-accent-cyan/10 text-white"
                            : "border-white/10 bg-white/5 text-white/75 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() => toggleFocusTopic(topic)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent"
                        />
                        <span>{topic}</span>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.focusTopics ? <p className="mt-2 text-sm text-amber-200">{fieldErrors.focusTopics}</p> : null}
              </div>
            ) : null}

            {selectedSessionType === "mentoring" ? (
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm text-white/70">Topics</p>
                  <span className="text-xs text-white/45">Select up to 3 topics maximum.</span>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {MENTORING_GOALS.map((topic) => {
                    const active = form.mentoringTopics.includes(topic);
                    const disableNewSelection = !active && form.mentoringTopics.length >= 3;
                    return (
                      <label
                        key={topic}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                          active
                            ? "cursor-pointer border-accent-cyan/60 bg-accent-cyan/10 text-white"
                            : disableNewSelection
                              ? "cursor-not-allowed border-white/10 bg-white/[0.03] text-white/35"
                              : "cursor-pointer border-white/10 bg-white/5 text-white/75 hover:border-white/20"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={active}
                          disabled={disableNewSelection}
                          onChange={() => toggleMentoringTopic(topic)}
                          className="h-4 w-4 rounded border-white/20 bg-transparent"
                        />
                        <span>{topic}</span>
                      </label>
                    );
                  })}
                </div>
                {fieldErrors.mentoringTopics ? <p className="mt-2 text-sm text-amber-200">{fieldErrors.mentoringTopics}</p> : null}
              </div>
            ) : null}

            {isRegeneration ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-semibold text-white">Health Focus Areas</h3>
                <p className="mt-2 text-sm text-white/60">
                  Focus on physical, emotional, or energetic areas you want addressed.
                </p>
                <div className="mt-4 space-y-3">
                  {form.healthFocusAreas.map((area, index) => (
                    <div key={`health-focus-${index + 1}`} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px]">
                      <input
                        className={fieldClassName}
                        type="text"
                        value={area.name}
                        onChange={(event) => updateHealthCondition(index, { name: event.target.value })}
                        placeholder={`Condition ${index + 1}`}
                      />
                      <select
                        className={`${fieldClassName} cursor-pointer`}
                        value={area.severity}
                        onChange={(event) => updateHealthCondition(index, { severity: event.target.value })}
                      >
                        <option value="" className="bg-slate-950">Severity</option>
                        {Array.from({ length: 10 }, (_, severityIndex) => severityIndex + 1).map((severity) => (
                          <option key={severity} value={severity} className="bg-slate-950">
                            {severity}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {fieldErrors.healthFocusAreas ? <p className="mt-3 text-sm text-amber-200">{fieldErrors.healthFocusAreas}</p> : null}
              </div>
            ) : null}

            {((selectedSessionType === "focus" && form.focusTopics.includes("Other"))
              || (selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other"))) ? (
                <FormField
                  label="Other Detail"
                  htmlFor="session-other-detail"
                  helperText="A few words here helps us understand what matters most."
                  errorText={fieldErrors.otherDetail}
                  isComplete={Boolean(normalizeText(form.otherDetail))}
                >
                  <input
                    id="session-other-detail"
                    className={fieldClassName}
                    value={form.otherDetail}
                    onChange={(event) => setFormField("otherDetail", event.target.value)}
                    onBlur={() => handleFieldBlur("otherDetail")}
                    placeholder="Tell us more"
                  />
                </FormField>
              ) : null}
          </div>
        ),
      },
      {
        id: "optional",
        title: "Optional inputs",
        guidance: "You're almost done. Add any extra context here if it feels relevant, otherwise you can move forward.",
        validate: validateOptionalStep,
        isComplete: () => true,
        render: () => (
          <FormField
            label="Additional Notes"
            htmlFor="session-additional-notes"
            helperText="Optional - include anything that feels useful before the session begins."
            optional
            isComplete={Boolean(normalizeText(form.additionalNotes))}
          >
            <textarea
              id="session-additional-notes"
              className={`${fieldClassName} min-h-[132px]`}
              rows={5}
              value={form.additionalNotes}
              onChange={(event) => setFormField("additionalNotes", event.target.value)}
              placeholder="Anything else you want us to know before the session."
            />
          </FormField>
        ),
      },
      {
        id: "review",
        title: "Review and confirm",
        guidance: "Everything looks good. Take a moment to review your details before you proceed to payment.",
        validate: validateReviewStep,
        isComplete: () => form.consentGiven,
        render: ({ goToStep }) => (
          <div className="space-y-4">
            <ReviewStep
              sections={reviewSections.map((section, index) => ({
                ...section,
                onEdit: () => goToStep(index),
              }))}
            />

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(event) => {
                  setFormField("consentGiven", event.target.checked);
                  if (event.target.checked) {
                    setSingleFieldError("consentGiven");
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>
                I consent to sharing this intake information so the session can be prepared and delivered.
                {fieldErrors.consentGiven ? <span className="mt-1 block text-amber-200">{fieldErrors.consentGiven}</span> : null}
              </span>
            </label>
          </div>
        ),
      },
    );

    return nextSteps;
  }, [
    availabilitySelection,
    availabilitySummary,
    availableTypes,
    bookingTypes,
    fieldErrors.availability,
    fieldErrors.birthDate,
    fieldErrors.birthPlace,
    fieldErrors.consentGiven,
    fieldErrors.email,
    fieldErrors.focusTopics,
    fieldErrors.fullName,
    fieldErrors.healthFocusAreas,
    fieldErrors.mentoringTopics,
    fieldErrors.otherDetail,
    fieldErrors.phone,
    fieldErrors.sessionType,
    fieldErrors.timezone,
    form,
    isPlaceSelected,
    isRegeneration,
    loadingTypes,
    placeSuggestions,
    requiresSchedule,
    resolvingPlace,
    searchingPlaces,
    selectedBookingType,
    selectedSessionType,
    suggestedTimezone,
    timezone,
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Sessions</h1>
        <p className="max-w-2xl text-white/60">
          Choose your session type, complete the intake that fits it, and submit when you are ready.
        </p>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-950/35 px-4 py-3 text-sm text-emerald-100">
          {success}
        </div>
      ) : null}

      <div className="mt-8">
        <FormStepper
          steps={steps}
          state={form}
          resetKey={location.pathname}
          onValidationErrors={setFieldErrors}
          onComplete={handlePurchase}
          completeLabel="Complete & Purchase Session"
          isSubmitting={isProcessing}
          submitError={purchaseError}
        />
      </div>
    </div>
  );
}
