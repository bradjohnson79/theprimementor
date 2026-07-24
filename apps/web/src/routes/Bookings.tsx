import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import {
  findTimezoneOption,
  getActiveSessionOfferingByBookingTypeId,
  getBrowserTimezoneName,
  getSuggestedTimezone,
} from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import FormField from "../components/forms/FormField";
import FormStepper, { type StepConfig } from "../components/forms/FormStepper";
import ReviewStep from "../components/forms/ReviewStep";
import PromoCodeInput from "../components/checkout/PromoCodeInput";
import RegenerationOfferCheckoutButton from "../components/regeneration-offer/RegenerationOfferCheckoutButton";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";
import { usePromoCode } from "../hooks/usePromoCode";
import { useRegenerationOfferStatus } from "../hooks/useRegenerationOfferStatus";
import regenerationOfferImage from "../assets/regeneration-qa-package.png";
import { api } from "../lib/api";
import { trackEventOnce } from "../lib/analytics";
import { formatRegenerationOfferPrice } from "../lib/regenerationOffer";
import { syncOwnedCheckoutSession } from "../lib/checkoutSessionSync";
import {
  createValidationResult,
  requiredStepMessage,
  type ValidationErrors,
} from "../lib/forms/validationEngine";
import {
  MENTORING_LANDING_PATH,
  QA_LANDING_PATH,
  REGENERATION_LANDING_PATH,
} from "../lib/sessionLandingPaths";
import {
  GUIDED_SESSION_BOOKING_PATH,
  getGuidedSessionDuration,
} from "../lib/sessionCatalog";
import { submitRegenerationBooking } from "../lib/submitRegenerationBooking";
import { startSessionCheckout } from "../lib/sessionCheckout";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_SLOTS,
  MENTORING_GOALS,
  SESSION_TYPE_OPTIONS,
  SESSION_TYPE_ORDER,
  createEmptyAvailabilitySelection,
  sessionTypeRequiresAvailabilitySelection,
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

interface DetectedTimezoneResponse {
  data?: {
    timezone?: string | null;
    source?: "edge_timezone" | "country_fallback" | null;
  };
}

type DetectedTimezoneSource = NonNullable<DetectedTimezoneResponse["data"]>["source"];
type ClientGender = "male" | "female";

interface IntakeFormState {
  fullName: string;
  email: string;
  phone: string;
  gender: ClientGender | "";
  birthDate: string;
  birthTime: string;
  birthPlace: string;
  additionalNotes: string;
  primaryManifestationIntention: string;
  mentoringTopics: string[];
  qaTopics: string;
  otherDetail: string;
  manifestationEnhancementSelected: boolean | null;
  manifestationIntentions: string;
  consentGiven: boolean;
}

function buildInitialFormState(prefill?: Partial<IntakeFormState>): IntakeFormState {
  return {
    fullName: prefill?.fullName ?? "",
    email: prefill?.email ?? "",
    phone: "",
    gender: "",
    birthDate: "",
    birthTime: "00:00",
    birthPlace: "",
    additionalNotes: "",
    primaryManifestationIntention: "",
    mentoringTopics: [],
    qaTopics: "",
    otherDetail: "",
    manifestationEnhancementSelected: null,
    manifestationIntentions: "",
    consentGiven: false,
  };
}

function normalizeText(value: string) {
  return value.trim();
}

function resolveSupportedBrowserTimezone() {
  return findTimezoneOption(getBrowserTimezoneName())?.ianaName ?? "UTC";
}

function resolveBirthTimeInput(value: string) {
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 5) : "00:00";
}

function resolveSessionTypeFromPath(pathname: string, bookingTypeId?: string | null): SessionType | null {
  if (pathname.includes(GUIDED_SESSION_BOOKING_PATH) && bookingTypeId) {
    return getGuidedSessionDuration(bookingTypeId)?.option.sessionType ?? null;
  }
  if (pathname.includes(QA_LANDING_PATH)) return "qa_session";
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
  if (!bookingType) {
    return null;
  }

  const formatted = formatSessionPrice(bookingType.price_cents, bookingType.currency);
  return sessionType === "regeneration" ? `${formatted} / month` : formatted;
}

function formatSessionDuration(sessionType: SessionType, durationMinutes: number | null) {
  if (sessionType === "regeneration") {
    return "Monthly 1-to-1";
  }
  if (!durationMinutes) {
    return null;
  }
  return `${durationMinutes} mins`;
}

function formatBookingTypeCardTitle(bookingType: BookingType) {
  const option = SESSION_TYPE_OPTIONS.find((item) => item.type === bookingType.session_type);
  const durationLabel = formatSessionDuration(bookingType.session_type, bookingType.duration_minutes);
  return [option?.label ?? bookingType.name, bookingType.session_type === "regeneration" ? null : durationLabel]
    .filter(Boolean)
    .join(" — ");
}

function getBookingTypeCardDescription(bookingType: BookingType) {
  const offeringDescription = getActiveSessionOfferingByBookingTypeId(bookingType.id)?.description;
  if (offeringDescription) return offeringDescription;

  return SESSION_TYPE_OPTIONS.find((item) => item.type === bookingType.session_type)?.description
    ?? "A private session with Brad Johnson.";
}

function countSelectedAvailability(selection: AvailabilitySelection) {
  return AVAILABILITY_DAYS.reduce((count, day) => count + selection[day].length, 0);
}

function hasSelectedAvailability(selection: AvailabilitySelection) {
  return countSelectedAvailability(selection) > 0;
}

function buildRegenerationFocusAreas(primaryManifestationIntention: string): HealthCondition[] {
  const name = normalizeText(primaryManifestationIntention);
  return name ? [{ name, severity: 10 }] : [];
}

function RegenerationBillingNotice() {
  return (
    <div className="rounded-2xl border border-amber-300/25 bg-amber-500/10 px-5 py-4 text-sm leading-7 text-amber-50/90">
      <p className="font-semibold uppercase tracking-[0.18em] text-amber-200/90">Important</p>
      <p className="mt-2">
        The Regeneration Monthly Package is $99 CAD/month and includes one 15-minute Zoom consultation with Brad Johnson,
        safeguarded manifestation work, offline anti-goal clearing, personalized MP3 clearing exercises, and 30-day priority
        email support. Your next monthly consultation is automatically scheduled approximately 30 days after your initial
        consultation. Cancel anytime.
      </p>
      <p className="mt-3">
        If you have questions about your Regeneration Monthly Package, please{" "}
        <Link to="/contact" className="font-medium text-amber-200 underline underline-offset-4 transition hover:text-white">
          Contact us
        </Link>
        .
      </p>
    </div>
  );
}

function RegenerationOfferSessionsSpotlight() {
  const { status } = useRegenerationOfferStatus();
  const [error, setError] = useState<string | null>(null);

  if (!status?.active) {
    return null;
  }

  return (
    <section className="overflow-hidden rounded-[2rem] border border-amber-200/24 bg-white/[0.055] shadow-[0_24px_70px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="space-y-5 p-6 sm:p-7">
          <div className="space-y-3">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-amber-100/75">Limited-Time Package</p>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white">Regeneration Q&A Package</h2>
            <p className="max-w-2xl text-sm leading-7 text-white/66">
              Includes one Regeneration Session, 30 days of priority email support, and one private 30-minute Q&A for {formatRegenerationOfferPrice(status)} CAD.
            </p>
          </div>
          <p className="text-sm leading-7 text-white/58">
            Your Q&A must be booked and used within the 30-day support window that begins after your Regeneration Session is completed.
          </p>
          <RegenerationOfferCheckoutButton
            source="sessions_regeneration_offer_spotlight"
            onError={setError}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          />
          {error ? <p className="text-sm text-amber-100">{error}</p> : null}
        </div>
        <div className="relative min-h-64 border-t border-white/10 lg:border-l lg:border-t-0">
          <img
            src={regenerationOfferImage}
            alt="Regeneration Q&A Package promotional artwork"
            className="h-full min-h-64 w-full object-cover"
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}

export default function Bookings() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser } = useCurrentUser();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [bookingTypes, setBookingTypes] = useState<BookingType[]>([]);
  const [selectedSessionType, setSelectedSessionType] = useState<SessionType | null>(null);
  const [selectedBookingTypeId, setSelectedBookingTypeId] = useState<string | null>(null);
  const [timezone, setTimezone] = useState("");
  const [timezoneSource, setTimezoneSource] = useState<"user" | "suggested" | "fallback">("user");
  const [timezoneManuallySelected, setTimezoneManuallySelected] = useState(false);
  const [detectedTimezoneSource, setDetectedTimezoneSource] = useState<DetectedTimezoneSource>(null);
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
  const promo = usePromoCode(getToken);
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

  const selectedBookingType = useMemo(
    () => {
      if (selectedBookingTypeId) {
        return bookingTypes.find((item) => item.id === selectedBookingTypeId) ?? null;
      }
      return null;
    },
    [bookingTypes, selectedBookingTypeId],
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

  const requiresAvailabilitySelection = selectedSessionType ? sessionTypeRequiresAvailabilitySelection(selectedSessionType) : false;
  const isRegeneration = selectedSessionType === "regeneration";
  const isQA = selectedSessionType === "qa_session";
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
    if (!selectedSessionType || timezoneManuallySelected) {
      return;
    }

    let cancelled = false;

    async function detectTimezone() {
      try {
        const response = (await api.get("/timezone/detect")) as DetectedTimezoneResponse;
        if (cancelled || timezoneManuallySelected) {
          return;
        }

        const detectedTimezone = findTimezoneOption(response.data?.timezone)?.ianaName;
        if (detectedTimezone) {
          setTimezone(detectedTimezone);
          setTimezoneSource("suggested");
          setDetectedTimezoneSource(response.data?.source ?? null);
          setFieldErrors((current) => {
            const next = { ...current };
            delete next.timezone;
            return next;
          });
          return;
        }
      } catch {
        // Browser timezone below keeps the form usable if edge geo headers are unavailable.
      }

      if (!cancelled && !timezoneManuallySelected) {
        setTimezone(resolveSupportedBrowserTimezone());
        setTimezoneSource("fallback");
        setDetectedTimezoneSource(null);
        setFieldErrors((current) => {
          const next = { ...current };
          delete next.timezone;
          return next;
        });
      }
    }

    void detectTimezone();
    return () => {
      cancelled = true;
    };
  }, [selectedSessionType, timezoneManuallySelected]);

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
    const bookingTypeId = searchParams.get("bookingTypeId")?.trim() || null;
    const resolvedSessionType = resolveSessionTypeFromPath(location.pathname, bookingTypeId);
    setSelectedSessionType(resolvedSessionType);
    setSelectedBookingTypeId(bookingTypeId);
    setError(null);
    setPurchaseError(null);
    setSuccess(null);
  }, [location.pathname, searchParams]);

  useEffect(() => {
    if (selectedBookingTypeId || selectedSessionType !== "regeneration") {
      return;
    }
    const regeneration = bookingTypes.find((item) => item.id === "regeneration-session") ?? null;
    if (regeneration) {
      setSelectedBookingTypeId(regeneration.id);
    }
  }, [bookingTypes, selectedBookingTypeId, selectedSessionType]);

  useEffect(() => {
    promo.reset();
  }, [promo.reset, selectedSessionType]);

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
          (left, right) => {
            const typeOrder = SESSION_TYPE_ORDER.indexOf(left.session_type) - SESSION_TYPE_ORDER.indexOf(right.session_type);
            return typeOrder || left.duration_minutes - right.duration_minutes;
          },
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
      delete next.primaryManifestationIntention;
      delete next.mentoringTopics;
      delete next.otherDetail;
      delete next.manifestationEnhancementSelected;
      delete next.manifestationIntentions;
      return next;
    });
    setForm((current) => ({
      ...current,
      primaryManifestationIntention: "",
      mentoringTopics: [],
      qaTopics: "",
      otherDetail: "",
      manifestationEnhancementSelected: null,
      manifestationIntentions: "",
    }));
    setBirthplace(null);
    setTimezone("");
    setTimezoneSource("user");
    setTimezoneManuallySelected(false);
    setDetectedTimezoneSource(null);
    setBirthTimeEdited(false);
  }, [selectedSessionType]);

  useEffect(() => {
    if (!isQA) {
      return;
    }
    setBirthplace(null);
    setForm((current) => ({
      ...current,
      birthPlace: "",
      birthTime: "00:00",
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.birthPlace;
      delete next.timezone;
      delete next.birthDate;
      return next;
    });
  }, [isQA]);

  function setFormField<K extends keyof IntakeFormState>(field: K, value: IntakeFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
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

  function setManifestationEnhancementSelected(selected: boolean) {
    setForm((current) => ({
      ...current,
      manifestationEnhancementSelected: selected,
      manifestationIntentions: selected ? current.manifestationIntentions : "",
    }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.manifestationEnhancementSelected;
      delete next.manifestationIntentions;
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
    if (requiresAvailabilitySelection && !hasSelectedAvailability(availabilitySelection)) {
      nextErrors.availability = "Select at least one availability slot.";
    }

    if (!normalizeText(form.fullName)) nextErrors.fullName = "Full name is required.";
    if (!normalizeText(form.email)) nextErrors.email = "Email is required.";
    if (!form.gender) nextErrors.gender = "Gender is required.";
    if (!isQA && !normalizeText(form.phone)) nextErrors.phone = "Phone number is required.";
    if (!isQA && !normalizeText(form.birthDate)) nextErrors.birthDate = "Birthdate is required.";
    if (!isQA && !isPlaceSelected) nextErrors.birthPlace = "Please select a valid birthplace from the dropdown.";
    if (!form.consentGiven) nextErrors.consentGiven = "Consent is required.";

    if (selectedSessionType === "mentoring" && form.mentoringTopics.length === 0) {
      nextErrors.mentoringTopics = "Select at least one topic.";
    }

    if (selectedSessionType === "regeneration") {
      if (!normalizeText(form.primaryManifestationIntention)) {
        nextErrors.primaryManifestationIntention = "Share the manifestation you want to work with.";
      }
      if (form.manifestationEnhancementSelected === null) {
        nextErrors.manifestationEnhancementSelected = "Choose whether you would like to include the optional first-month add-on.";
      }
      if (form.manifestationEnhancementSelected === true && !normalizeText(form.manifestationIntentions)) {
        nextErrors.manifestationIntentions = "Share the additional manifestation request you would like supported.";
      }
    }

    const needsOtherDetail = selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other");
    if (needsOtherDetail && !normalizeText(form.otherDetail)) {
      nextErrors.otherDetail = "Tell us what “Other” means for you.";
    }

    return nextErrors;
  }

  function buildBookingPayload(place?: PlaceResult | null) {
    const intake: Record<string, unknown> = {
      type: selectedSessionType,
      gender: form.gender,
    };

    if (selectedSessionType === "mentoring") {
      intake.goals = form.mentoringTopics;
    }

    if (selectedSessionType === "regeneration") {
      intake.manifestationIntention = normalizeText(form.primaryManifestationIntention);
      intake.healthFocusAreas = buildRegenerationFocusAreas(form.primaryManifestationIntention);
      intake.manifestationEnhancement = {
        version: 1,
        selected: form.manifestationEnhancementSelected === true,
        intentions: form.manifestationEnhancementSelected === true
          ? normalizeText(form.manifestationIntentions)
          : undefined,
        priceCents: 2900,
        currency: "CAD",
      };
    }

    if (selectedSessionType === "qa_session" && normalizeText(form.qaTopics)) {
      intake.topics = normalizeText(form.qaTopics);
    }

    if (normalizeText(form.otherDetail)) {
      intake.other = normalizeText(form.otherDetail);
    }

    return {
      bookingTypeId: selectedBookingType?.id,
      sessionType: selectedSessionType,
      availability: requiresAvailabilitySelection ? availabilitySelection : undefined,
      timezone,
      fullName: normalizeText(form.fullName),
      email: normalizeText(form.email),
      phone: normalizeText(form.phone) || undefined,
      gender: form.gender,
      birthDate: form.birthDate || undefined,
      birthTime: isQA ? undefined : resolveBirthTimeInput(form.birthTime),
      birthPlace: isQA ? undefined : normalizeText(form.birthPlace),
      birthPlaceName: isQA ? undefined : place?.name,
      birthLat: isQA ? undefined : place?.lat,
      birthLng: isQA ? undefined : place?.lng,
      birthTimezone: isQA ? undefined : (timezone || undefined),
      timezoneSource,
      consentGiven: form.consentGiven,
      intake,
      notes: isQA ? undefined : (normalizeText(form.additionalNotes) || undefined),
    };
  }

  async function handlePurchase() {
    setError(null);
    setPurchaseError(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !selectedSessionType || !selectedBookingType || (!isQA && !birthplace)) {
      return;
    }

    setIsProcessing(true);
    try {
      const token = await getToken();
      const bookingPayload = buildBookingPayload(isQA ? null : birthplace);

      if (isRegeneration) {
        const { bookingId } = await submitRegenerationBooking({
          token,
          payload: bookingPayload,
        });

        trackEventOnce(`analytics:regeneration-booked:${bookingId}`, "session_booked", {
          source: "regeneration_checkout_create",
          sessionType: selectedSessionType,
          bookingId,
        });
        return;
      }

      const bookingResponse = (await api.post(
        "/bookings",
        bookingPayload,
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
        await startSessionCheckout(bookingResponse.bookingId, {
          token,
          promoCode: promo.validation?.code ?? null,
        });
      } catch {
        setPurchaseError("Something went wrong. Please try again.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to start your session purchase.";
      if (isRegeneration) {
        setPurchaseError(message);
      } else {
        setError(message);
      }
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
    if (!form.gender) nextErrors.gender = requiredStepMessage("Gender");
    if (!isQA && !normalizeText(form.phone)) nextErrors.phone = requiredStepMessage("Your phone number");
    return createValidationResult(nextErrors);
  }

  function validateBirthDetailsStep() {
    const nextErrors: ValidationErrors = {};
    if (isQA) {
      return createValidationResult(nextErrors);
    }
    if (!normalizeText(form.birthDate)) nextErrors.birthDate = requiredStepMessage("Your birth date");
    if (!isPlaceSelected) nextErrors.birthPlace = "Please choose your birthplace from the list so we can keep the details precise.";
    return createValidationResult(nextErrors);
  }

  function validateAvailabilityStep() {
    const nextErrors: ValidationErrors = {};
    if (requiresAvailabilitySelection && !hasSelectedAvailability(availabilitySelection)) {
      nextErrors.availability = "Just one more step here before we continue. Pick at least one time that works for you.";
    }
    if (requiresAvailabilitySelection && !timezone) {
      nextErrors.timezone = requiredStepMessage("Your timezone");
    }
    return createValidationResult(nextErrors);
  }

  function validateIntentStep() {
    const nextErrors: ValidationErrors = {};

    if (selectedSessionType === "qa_session" && normalizeText(form.qaTopics).length > 2000) {
      nextErrors.qaTopics = "Keep this to 2000 characters or fewer so the intake stays focused.";
    }

    if (selectedSessionType === "mentoring" && form.mentoringTopics.length === 0) {
      nextErrors.mentoringTopics = "Choose at least one mentoring topic so we can tune in properly.";
    }

    if (selectedSessionType === "regeneration") {
      if (!normalizeText(form.primaryManifestationIntention)) {
        nextErrors.primaryManifestationIntention = "Share the manifestation you want to work with before we continue.";
      }
      if (form.manifestationEnhancementSelected === null) {
        nextErrors.manifestationEnhancementSelected = "Choose whether you would like to include the optional first-month add-on.";
      }
      if (form.manifestationEnhancementSelected === true && !normalizeText(form.manifestationIntentions)) {
        nextErrors.manifestationIntentions = "Share the additional manifestation request you would like supported.";
      }
    }

    const needsOtherDetail = selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other");
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

  function handleFieldBlur(field: "fullName" | "email" | "phone" | "gender" | "birthDate" | "birthPlace" | "timezone" | "otherDetail" | "qaTopics") {
    const validators: Record<typeof field, () => string | undefined> = {
      fullName: () => (normalizeText(form.fullName) ? undefined : requiredStepMessage("Your full name")),
      email: () => (normalizeText(form.email) ? undefined : requiredStepMessage("Your email")),
      phone: () => (isQA || normalizeText(form.phone) ? undefined : requiredStepMessage("Your phone number")),
      gender: () => (form.gender ? undefined : requiredStepMessage("Gender")),
      birthDate: () => (isQA || normalizeText(form.birthDate) ? undefined : requiredStepMessage("Your birth date")),
      birthPlace: () => (isQA || isPlaceSelected ? undefined : "Please choose your birthplace from the list so we can keep the details precise."),
      timezone: () => (timezone ? undefined : requiredStepMessage("Your timezone")),
      otherDetail: () => {
        const needsOtherDetail = selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other");
        return !needsOtherDetail || normalizeText(form.otherDetail)
          ? undefined
          : "Tell us a little more about what 'Other' means for you.";
      },
      qaTopics: () => (normalizeText(form.qaTopics).length <= 2000
        ? undefined
        : "Keep this to 2000 characters or fewer so the intake stays focused."),
    };

    setSingleFieldError(field, validators[field]());
  }

  const reviewSections = useMemo(() => {
    const sections = [
      {
        id: "session-choice",
        title: "Session Choice",
        items: [
          { label: "Session", value: selectedBookingType ? formatBookingTypeCardTitle(selectedBookingType) : "Not selected yet" },
          {
            label: "Duration",
            value: selectedBookingType
              ? formatSessionDuration(selectedBookingType.session_type, selectedBookingType.duration_minutes) ?? "Not selected yet"
              : "Not selected yet",
          },
          { label: "Pricing", value: selectedSessionType ? resolveSessionCardPrice(selectedSessionType, selectedBookingType) ?? "Available after selection" : "Available after selection" },
        ],
      },
      {
        id: "basic-info",
        title: "Basic Info",
        items: [
          { label: "Full Name", value: form.fullName || "Not provided yet" },
          { label: "Email", value: form.email || "Not provided yet" },
          { label: "Gender", value: form.gender ? form.gender[0].toUpperCase() + form.gender.slice(1) : "Not provided yet" },
          { label: "Phone", value: form.phone || "None added" },
          { label: "Birth Date", value: form.birthDate || "None added" },
        ],
      },
    ];

    if (isRegeneration) {
      sections.unshift({
        id: "selected-services",
        title: "Selected Services",
        items: [
          { label: "Regeneration Monthly Package — $99 CAD / month", value: "Selected" },
          {
            label: "Optional: Add Additional Manifestation Request for First Month (+$29 CAD)",
            value: form.manifestationEnhancementSelected === true ? "Selected" : "Not selected",
          },
          {
            label: "Today's Total",
            value: form.manifestationEnhancementSelected === true ? "$128 CAD" : "$99 CAD",
          },
        ],
      });
    }

    if (!isQA) {
      sections.push({
        id: "birth-details",
        title: "Birth Details",
        items: [
          { label: "Birth Date", value: form.birthDate || "Not provided yet" },
          { label: "Birth Time", value: form.birthTime || "12:00 AM" },
          { label: "Birthplace", value: form.birthPlace || "Not provided yet" },
        ],
      });
    }

    if (requiresAvailabilitySelection) {
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
          { label: "Timezone", value: timezone || "Not selected yet" },
        ],
      });
    }

    if (isQA) {
      sections.push({
        id: "topics",
        title: "Topics",
        items: [
          {
            label: "What you'd like to explore",
            value: normalizeText(form.qaTopics) || "No topics added yet",
          },
          { label: "Consent", value: form.consentGiven ? "Confirmed" : "Please confirm before purchase" },
        ],
      });
    } else {
      sections.push({
        id: "intent",
        title: "Session Intent",
        items: [
          {
            label: selectedSessionType === "mentoring" ? "Mentoring goals" : "Regeneration Focus",
            value: selectedSessionType === "mentoring"
              ? (form.mentoringTopics.join(", ") || "Not selected yet")
              : normalizeText(form.primaryManifestationIntention) || "Not added yet",
          },
          {
            label: "Other Detail",
            value: normalizeText(form.otherDetail) || "None added",
          },
        ],
      });

      if (isRegeneration) {
        sections.push({
          id: "manifestation-enhancement",
          title: "Optional First-Month Add-On",
          items: [
            {
              label: "Optional: Add Additional Manifestation Request for First Month (+$29 CAD)",
              value: form.manifestationEnhancementSelected === true
                ? "Additional manifestation request selected"
                : form.manifestationEnhancementSelected === false
                  ? "Regeneration only"
                  : "Not chosen yet",
            },
            ...(form.manifestationEnhancementSelected === true
              ? [{
                  label: "Additional Manifestation Request",
                  value: normalizeText(form.manifestationIntentions) || "Not added yet",
                }]
              : []),
          ],
        });
      }

      sections.push({
        id: "optional",
        title: "Optional Inputs",
        items: [
          { label: "Additional Notes", value: normalizeText(form.additionalNotes) || "None added" },
          { label: "Consent", value: form.consentGiven ? "Confirmed" : "Please confirm before purchase" },
        ],
      });
    }

    return sections;
  }, [
    availabilitySummary,
    form.additionalNotes,
    form.birthDate,
    form.birthPlace,
    form.birthTime,
    form.consentGiven,
    form.email,
    form.fullName,
    form.gender,
    form.manifestationEnhancementSelected,
    form.manifestationIntentions,
    form.mentoringTopics,
    form.otherDetail,
    form.primaryManifestationIntention,
    form.qaTopics,
    form.phone,
    isRegeneration,
    isQA,
    requiresAvailabilitySelection,
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

            <div className="grid gap-4 md:grid-cols-2">
              {bookingTypes.map((bookingType) => {
                const isActive = selectedBookingTypeId === bookingType.id;
                const priceLabel = resolveSessionCardPrice(bookingType.session_type, bookingType);
                const durationLabel = formatSessionDuration(bookingType.session_type, bookingType.duration_minutes);
                return (
                  <motion.button
                    key={bookingType.id}
                    type="button"
                    onClick={() => {
                      setSelectedSessionType(bookingType.session_type);
                      setSelectedBookingTypeId(bookingType.id);
                      setError(null);
                      setSuccess(null);
                      setSingleFieldError("sessionType");
                    }}
                    whileTap={{ scale: 0.99 }}
                    animate={isActive ? { scale: 1.03 } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`relative flex h-full min-h-[220px] flex-col overflow-hidden rounded-2xl border px-4 py-4 text-left transition ${
                      isActive
                        ? "border-amber-300/60 bg-accent-cyan/10 text-white shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                        : "border-white/10 bg-white/5 text-white hover:border-white/25"
                    }`}
                  >
                    {isActive ? (
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_60%)]" />
                    ) : null}
                    <div className="relative">
                      <div className="text-base font-semibold">{formatBookingTypeCardTitle(bookingType)}</div>
                      {priceLabel || durationLabel ? (
                        <p className="mt-2 min-h-[1.25rem] text-sm font-medium text-amber-200/90">
                          {[priceLabel, durationLabel].filter(Boolean).join(" · ")}
                        </p>
                      ) : null}
                      <p className="mt-2 flex-1 whitespace-pre-line text-sm leading-6 text-white/60">
                        {getBookingTypeCardDescription(bookingType)}
                      </p>
                      {bookingType.session_type === "regeneration" ? (
                        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                          Monthly subscription
                        </p>
                      ) : null}
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
        guidance: isQA
          ? "Keep this simple. Confirm the basics so we can get your Q&A session moving quickly."
          : "Tell us who this session is for. Keeping this section simple helps everything feel more effortless.",
        validate: validateBasicInfoStep,
        isComplete: (state) => Boolean(
          normalizeText(state.fullName)
          && normalizeText(state.email)
          && state.gender
          && (isQA || normalizeText(state.phone)),
        ),
        render: () => (
          <div className="space-y-4">
            {isRegeneration ? <RegenerationBillingNotice /> : null}
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
                label="Gender"
                htmlFor="session-gender"
                helperText="This helps us keep AI-generated reports clear when a name could be interpreted more than one way."
                errorText={fieldErrors.gender}
                isComplete={Boolean(form.gender)}
              >
                <select
                  id="session-gender"
                  className={`${fieldClassName} bg-white text-black`}
                  style={{ backgroundColor: "#fff", color: "#000" }}
                  value={form.gender}
                  onChange={(event) => setFormField("gender", event.target.value as ClientGender | "")}
                  onBlur={() => handleFieldBlur("gender")}
                >
                  <option className="bg-white text-black" style={{ backgroundColor: "#fff", color: "#000" }} value="">
                    Select gender
                  </option>
                  <option className="bg-white text-black" style={{ backgroundColor: "#fff", color: "#000" }} value="male">
                    Male
                  </option>
                  <option className="bg-white text-black" style={{ backgroundColor: "#fff", color: "#000" }} value="female">
                    Female
                  </option>
                </select>
              </FormField>

              <FormField
                label="Phone Number"
                htmlFor="session-phone"
                helperText={isQA
                  ? "Optional - include the best number if you'd like us to have it for scheduling follow-up."
                  : "This helps us reach you if we need to confirm scheduling details."}
                errorText={isQA ? undefined : fieldErrors.phone}
                isComplete={Boolean(normalizeText(form.phone))}
                optional={isQA}
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

              {isQA ? (
                <FormField
                  label="Birthdate"
                  htmlFor="session-birth-date"
                  helperText="Optional - include it if it feels relevant for the session."
                  optional
                  isComplete={Boolean(normalizeText(form.birthDate))}
                  className="md:col-span-2"
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
              ) : null}
            </div>
          </div>
        ),
      },
    ];

    if (requiresAvailabilitySelection) {
      nextSteps.push({
        id: "availability",
        title: "Availability",
        guidance: "Share the days, times, and timezone that work best for you. This helps us personally schedule your session without any rush.",
        validate: validateAvailabilityStep,
        isComplete: () => hasSelectedAvailability(availabilitySelection) && Boolean(timezone),
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
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {AVAILABILITY_SLOTS[day].map((time) => {
                      const active = availabilitySelection[day].includes(time);
                      return (
                        <label
                          key={`${day}-${time}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition ${
                            active
                              ? "border-accent-cyan/60 bg-accent-cyan/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={active}
                            onChange={() => toggleAvailability(day, time)}
                            className="h-4 w-4 rounded border-white/20 bg-transparent text-accent-cyan focus:ring-accent-cyan/40"
                          />
                          <span className="font-medium">{formatAvailabilityTime(time)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

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
                    setTimezoneManuallySelected(true);
                    setDetectedTimezoneSource(null);
                    setSingleFieldError("timezone");
                  }}
                  required
                  className={fieldClassName}
                  autoSelectBrowserTimezone={false}
                />
                {detectedTimezoneSource && timezoneSource === "suggested" ? (
                  <span className="mt-2 block text-xs text-emerald-200/85">
                    Timezone detected from your location. You can change it if needed.
                  </span>
                ) : null}
                {suggestedTimezone ? (
                  <span className="mt-2 block text-xs text-white/45">
                    Suggested timezone: <span className="text-white/75">{suggestedTimezone}</span>{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setTimezone(suggestedTimezone);
                        setTimezoneSource("suggested");
                        setTimezoneManuallySelected(true);
                        setDetectedTimezoneSource(null);
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

            {fieldErrors.availability ? <p className="text-sm text-amber-200">{fieldErrors.availability}</p> : null}
          </div>
        ),
      });
    }

    if (!isQA) {
      nextSteps.push({
        id: "birth-details",
        title: "Birth details",
        guidance: "Enter your birth details. If you're unsure of your birth time, you can leave the default in place and continue.",
        validate: validateBirthDetailsStep,
        isComplete: () => Boolean(normalizeText(form.birthDate) && isPlaceSelected),
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

            </div>
          </div>
        ),
      });
    }

    if (isQA) {
      nextSteps.push({
        id: "topics",
        title: "Topics",
        guidance: "Use this space for any questions, themes, or areas you'd like to explore. It can stay broad or be very specific.",
        validate: validateIntentStep,
        isComplete: () => normalizeText(form.qaTopics).length <= 2000,
        render: () => (
          <FormField
            label="What would you like to explore during this session?"
            htmlFor="session-qa-topics"
            helperText="Optional but encouraged. Share any questions, themes, or areas you'd like to discuss."
            errorText={fieldErrors.qaTopics}
            optional
            isComplete={Boolean(normalizeText(form.qaTopics))}
          >
            <textarea
              id="session-qa-topics"
              className={`${fieldClassName} min-h-[168px]`}
              rows={6}
              maxLength={2000}
              value={form.qaTopics}
              onChange={(event) => setFormField("qaTopics", event.target.value)}
              onBlur={() => handleFieldBlur("qaTopics")}
              placeholder="List any questions, topics, or areas you would like to discuss. These can be personal, spiritual, practical, or curiosity-based."
            />
          </FormField>
        ),
      });
    } else {
      nextSteps.push(
        {
          id: "intent",
          title: selectedSessionType === "regeneration" ? "Regeneration Focus" : "Session intent",
          guidance:
            selectedSessionType === "regeneration"
              ? "Share the personal state, manifestation, or life area you want regenerated, safeguarded, and amplified."
              : "This helps us better tune into your situation and guide the session with precision.",
          validate: validateIntentStep,
          isComplete: () => {
            if (selectedSessionType === "mentoring") return form.mentoringTopics.length > 0 && (!form.mentoringTopics.includes("Other") || Boolean(normalizeText(form.otherDetail)));
            return Boolean(normalizeText(form.primaryManifestationIntention))
              && form.manifestationEnhancementSelected !== null
              && (form.manifestationEnhancementSelected !== true || Boolean(normalizeText(form.manifestationIntentions)));
          },
          render: () => (
            <div className="space-y-4">
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
                <div className="space-y-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-semibold text-white">Regeneration Focus</h3>
                  <p className="mt-2 text-sm text-white/60">
                    Share the manifestation you want to work with during this monthly cycle.
                  </p>

                  <FormField
                    label="Manifestation Request"
                    htmlFor="session-primary-manifestation"
                    helperText="Describe the one manifestation, personal state, or life area you want regenerated, safeguarded, and amplified."
                    errorText={fieldErrors.primaryManifestationIntention}
                    isComplete={Boolean(normalizeText(form.primaryManifestationIntention))}
                  >
                    <textarea
                      id="session-primary-manifestation"
                      className={`${fieldClassName} min-h-[168px]`}
                      rows={6}
                      value={form.primaryManifestationIntention}
                      onChange={(event) => setFormField("primaryManifestationIntention", event.target.value)}
                      placeholder="Describe the manifestation you want to work with."
                    />
                  </FormField>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <h3 className="text-base font-semibold text-white">Would you like to add one additional manifestation request for your first month?</h3>
                    <p className="mt-3 text-sm leading-7 text-white/62">
                      For +$29 CAD, Brad can safeguard and amplify one extra desired outcome within the same monthly cycle.
                    </p>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {[
                        {
                          selected: true,
                          title: "Yes - Add Additional Manifestation Request (+$29 CAD)",
                          description: "Add one additional manifestation request during the first monthly cycle.",
                        },
                        {
                          selected: false,
                          title: "No - Continue with Regeneration Only",
                          description: "Continue with the standard Regeneration Monthly Package.",
                        },
                      ].map((option) => {
                        const active = form.manifestationEnhancementSelected === option.selected;
                        return (
                          <button
                            key={option.title}
                            type="button"
                            onClick={() => setManifestationEnhancementSelected(option.selected)}
                            className={`rounded-xl border px-4 py-4 text-left transition ${
                              active
                                ? "border-cyan-300/60 bg-cyan-400/12 text-white shadow-[0_0_22px_rgba(34,211,238,0.12)]"
                                : "border-white/10 bg-white/[0.03] text-white/72 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            <span className="block text-sm font-semibold">{option.title}</span>
                            <span className="mt-2 block text-sm leading-6 text-white/58">{option.description}</span>
                          </button>
                        );
                      })}
                    </div>
                    {fieldErrors.manifestationEnhancementSelected ? (
                      <p className="mt-3 text-sm text-amber-200">{fieldErrors.manifestationEnhancementSelected}</p>
                    ) : null}
                  </div>

                  {form.manifestationEnhancementSelected === true ? (
                    <FormField
                      label="Additional Manifestation Request"
                      htmlFor="session-manifestation-intentions"
                      helperText="Describe the additional manifestation you would like supported, safeguarded, and amplified during this first monthly cycle."
                      errorText={fieldErrors.manifestationIntentions}
                      isComplete={Boolean(normalizeText(form.manifestationIntentions))}
                    >
                      <textarea
                        id="session-manifestation-intentions"
                        className={`${fieldClassName} min-h-[168px]`}
                        rows={6}
                        value={form.manifestationIntentions}
                        onChange={(event) => setFormField("manifestationIntentions", event.target.value)}
                        placeholder="Share the additional desired outcome you would like supported during this first monthly cycle."
                      />
                    </FormField>
                  ) : null}
                </div>
              ) : null}

              {selectedSessionType === "mentoring" && form.mentoringTopics.includes("Other") ? (
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
      );
    }

    nextSteps.push(
      {
        id: "review",
        title: "Review and confirm",
        guidance: isRegeneration
          ? "Everything looks good. Review your intake, then continue to secure checkout to start the Regeneration Monthly Package."
          : "Everything looks good. Take a moment to review your details before you proceed to payment.",
        validate: validateReviewStep,
        isComplete: () => form.consentGiven,
        render: ({ goToStep }) => (
          <div className="space-y-4">
            {isRegeneration ? <RegenerationBillingNotice /> : null}
            <ReviewStep
              sections={reviewSections.map((section) => {
                const targetStepId = section.id === "selected-services" || section.id === "manifestation-enhancement"
                  ? "intent"
                  : section.id;
                const targetStepIndex = Math.max(0, nextSteps.findIndex((step) => step.id === targetStepId));
                return {
                  ...section,
                  onEdit: () => goToStep(targetStepIndex),
                };
              })}
            />

            {selectedSessionType && !isRegeneration ? (
              <PromoCodeInput
                code={promo.code}
                onCodeChange={promo.setCode}
                onApply={() => {
                  void promo.apply({
                    type: "session",
                    sessionType: selectedSessionType,
                    bookingTypeId: selectedBookingType?.id,
                  });
                }}
                onRemove={promo.clear}
                applying={promo.applying}
                error={promo.error}
                appliedCode={promo.validation?.code ?? null}
                estimatedDiscount={promo.validation?.estimatedDiscount ?? null}
                finalEstimate={promo.validation?.finalEstimate ?? null}
                currency={promo.validation?.currency ?? null}
              />
            ) : null}

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
    bookingTypes,
    detectedTimezoneSource,
    fieldErrors.availability,
    fieldErrors.birthDate,
    fieldErrors.birthPlace,
    fieldErrors.consentGiven,
    fieldErrors.email,
    fieldErrors.fullName,
    fieldErrors.gender,
    fieldErrors.manifestationEnhancementSelected,
    fieldErrors.manifestationIntentions,
    fieldErrors.mentoringTopics,
    fieldErrors.otherDetail,
    fieldErrors.phone,
    fieldErrors.primaryManifestationIntention,
    fieldErrors.sessionType,
    fieldErrors.timezone,
    form,
    isPlaceSelected,
    isRegeneration,
    loadingTypes,
    placeSuggestions,
    fieldErrors.qaTopics,
    isQA,
    requiresAvailabilitySelection,
    resolvingPlace,
    searchingPlaces,
    selectedBookingType,
    selectedSessionType,
    suggestedTimezone,
    timezone,
    timezoneSource,
    promo,
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">
          {isRegeneration ? "Regeneration Monthly Package" : "Sessions"}
        </h1>
        <p className="max-w-2xl text-white/60">
          {isRegeneration
            ? "Complete your intake first, then continue to Stripe to begin the Regeneration Monthly Package at $99 CAD / month. Cancel anytime."
            : "Choose your session type, complete the intake that fits it, and submit when you are ready."}
        </p>
      </div>

      <div className="mt-8">
        <RegenerationOfferSessionsSpotlight />
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
          resetKey={`${location.pathname}${location.search}`}
          onValidationErrors={setFieldErrors}
          onComplete={handlePurchase}
          completeLabel={isRegeneration ? "Continue to Secure Checkout" : "Complete & Purchase Session"}
          isSubmitting={isProcessing}
          submitError={purchaseError}
        />
      </div>
    </div>
  );
}
