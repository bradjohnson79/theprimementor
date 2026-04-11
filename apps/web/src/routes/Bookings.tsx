import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useAuth, useUser } from "@clerk/react";
import { useLocation } from "react-router-dom";
import { getSuggestedTimezone } from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import { useCurrentUser } from "../hooks/useCurrentUser";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";
import { api } from "../lib/api";
import { startSessionCheckout } from "../lib/sessionCheckout";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_SLOTS,
  FOCUS_TOPICS,
  MENTORING_GOALS,
  SESSION_TYPE_OPTIONS,
  SESSION_TYPE_ORDER,
  createEmptyAvailabilitySelection,
  sessionTypeRequiresSchedule,
  type AvailabilityDay,
  type AvailabilitySelection,
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
  mentoringGoal: string;
  otherDetail: string;
  consentGiven: boolean;
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
    mentoringGoal: "",
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
  if (pathname.endsWith("/focus")) return "focus";
  if (pathname.endsWith("/regeneration")) return "regeneration";
  if (pathname.endsWith("/mentoring")) return "mentoring";
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
  const canShowIntake = Boolean(selectedSessionType);
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
    const params = new URLSearchParams(location.search);
    const checkoutState = params.get("checkout");

    if (checkoutState === "success") {
      setError(null);
      setPurchaseError(null);
      setSuccess("Payment received. Your booking is confirmed and will now move into the scheduling flow.");
      return;
    }

    if (checkoutState === "canceled") {
      setSuccess(null);
      setPurchaseError("Checkout was canceled. Your pending booking was kept, so you can try again when you're ready.");
    }
  }, [location.search]);

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
      delete next.mentoringGoal;
      delete next.otherDetail;
      return next;
    });
    setForm((current) => ({
      ...current,
      focusTopics: [],
      mentoringGoal: "",
      otherDetail: "",
    }));
    setBirthplace(null);
    setTimezone("");
    setTimezoneSource("user");
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
      const focusTopics = hasTopic
        ? current.focusTopics.filter((item) => item !== topic)
        : [...current.focusTopics, topic];
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

    if (selectedSessionType === "mentoring" && !normalizeText(form.mentoringGoal)) {
      nextErrors.mentoringGoal = "Choose a goal.";
    }

    const needsOtherDetail = (selectedSessionType === "focus" && form.focusTopics.includes("Other"))
      || (selectedSessionType === "mentoring" && form.mentoringGoal === "Other");
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
      intake.goals = form.mentoringGoal ? [form.mentoringGoal] : undefined;
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handlePurchase();
  }

  const isPurchaseReady = canShowIntake
    && !loadingTypes
    && !isProcessing
    && !resolvingPlace
    && !placesError
    && isPlaceSelected
    && Object.keys(validateForm()).length === 0;

  const fieldClassName =
    "mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";
  const labelClassName = "block text-sm text-white/70";
  const purchaseButtonClassName =
    "w-full rounded-xl bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_0_20px_rgba(255,215,0,0.18)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/60 sm:w-auto";

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white">Sessions</h1>
        <p className="max-w-2xl text-white/60">
          Choose your session type, share your availability if needed, and complete the intake when you are ready.
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

      <section className="glass-card cosmic-motion mt-8 rounded-2xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">1. Session Type</h2>
            <p className="mt-2 text-sm text-white/60">Start by choosing the type of session you want to request.</p>
          </div>
          {loadingTypes ? <span className="text-xs text-white/45">Loading options...</span> : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {SESSION_TYPE_OPTIONS.map((option) => {
            const isAvailable = availableTypes.has(option.type);
            const isActive = selectedSessionType === option.type;
            const bookingTypeForCard = bookingTypes.find((item) => item.session_type === option.type) ?? null;
            const priceLabel = resolveSessionCardPrice(option.type, bookingTypeForCard);
            const durationLabel = formatSessionDuration(option.type, bookingTypeForCard?.duration_minutes ?? null);
            return (
              <button
                key={option.type}
                type="button"
                disabled={!isAvailable}
                onClick={() => {
                  setSelectedSessionType(option.type);
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex h-full min-h-[220px] flex-col rounded-2xl border px-4 py-4 text-left transition ${
                  isActive
                    ? "border-accent-cyan/60 bg-accent-cyan/10 text-white shadow-[0_0_20px_rgba(6,182,212,0.08)]"
                    : "border-white/10 bg-white/5 text-white hover:border-white/25"
                } ${!isAvailable ? "cursor-not-allowed opacity-50" : ""}`}
              >
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
              </button>
            );
          })}
        </div>
        {fieldErrors.sessionType ? <p className="mt-3 text-sm text-red-300">{fieldErrors.sessionType}</p> : null}
      </section>

      {selectedSessionType ? (
        <section className="glass-card cosmic-motion mt-6 rounded-2xl p-5 sm:p-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
              {requiresSchedule ? "2. Availability" : "2. Intake"}
            </h2>
            {requiresSchedule ? (
              <p className="mt-2 text-sm text-white/60">
                Share your general availability in <span className="font-medium text-white">{timezone}</span>. Your
                final session time will be personally scheduled from the times you select below.
              </p>
            ) : (
              <p className="mt-2 text-sm text-white/60">
                Regeneration sessions do not require availability windows. Complete the intake below and we’ll handle
                the offline scheduling flow from there.
              </p>
            )}
          </div>

          {requiresSchedule ? (
            <>
              <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-4 text-sm text-white/85">
                <p>Please select your availability below.</p>
                <p className="mt-2 text-white/65">
                  This does not confirm a specific booking time. Your session will be personally scheduled based on your
                  submitted availability, and you will receive a confirmation with your finalized session time.
                </p>
              </div>

              <div className="mt-6 space-y-5">
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

              {fieldErrors.availability ? <p className="mt-4 text-sm text-red-300">{fieldErrors.availability}</p> : null}

              <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/40">Your Selected Availability</p>
                {availabilitySummary.length > 0 ? (
                  <div className="mt-3 space-y-2 text-sm text-white/75">
                    {availabilitySummary.map((entry) => (
                      <p key={entry.day}>
                        <span className="font-medium text-white">{entry.label}:</span> {entry.times.join(", ")}
                      </p>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/50">No availability selected yet.</p>
                )}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {canShowIntake ? (
        <section className="glass-card cosmic-motion mt-6 rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">
            {requiresSchedule ? "3. Intake Form" : "2. Intake Form"}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Share the details we need before the session. Required fields must be completed before submission.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClassName}>
                Full Name
                <input
                  className={fieldClassName}
                  value={form.fullName}
                  onChange={(event) => setFormField("fullName", event.target.value)}
                  placeholder="Your full name"
                />
                {fieldErrors.fullName ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.fullName}</span> : null}
              </label>

              <label className={labelClassName}>
                Email
                <input className={fieldClassName} type="email" value={form.email} readOnly />
                {fieldErrors.email ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.email}</span> : null}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClassName}>
                Phone Number
                <input
                  className={fieldClassName}
                  value={form.phone}
                  onChange={(event) => setFormField("phone", event.target.value)}
                  placeholder="Your phone number"
                />
                {fieldErrors.phone ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.phone}</span> : null}
              </label>

              <label className={labelClassName}>
                Birthdate
                <input
                  className={fieldClassName}
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setFormField("birthDate", event.target.value)}
                />
                {fieldErrors.birthDate ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.birthDate}</span> : null}
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className={labelClassName}>
                Birthtime (optional)
                <input
                  className={fieldClassName}
                  type="time"
                  value={form.birthTime}
                  onChange={(event) => setFormField("birthTime", event.target.value)}
                />
                <span className="mt-1 block text-xs text-white/45">If unknown, it will default to 12:00 AM.</span>
              </label>

              <label className={labelClassName}>
                Birthplace
                {isPlaceSelected ? (
                  <span className="ml-2 inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                    Coordinates confirmed: {birthplace!.lat.toFixed(4)}, {birthplace!.lng.toFixed(4)}
                  </span>
                ) : null}
                <input
                  className={fieldClassName}
                  value={form.birthPlace}
                  onChange={(event) => {
                    const value = event.target.value;
                    setFormField("birthPlace", value);
                    if (!birthplace || value !== birthplace.name) {
                      setBirthplace(null);
                    }
                  }}
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
                <span className="mt-1 block text-xs text-white/45">
                  Start typing and select your birthplace from the list.
                </span>
                {searchingPlaces ? <span className="mt-1 block text-xs text-white/45">Searching places...</span> : null}
                {resolvingPlace ? <span className="mt-1 block text-xs text-white/45">Loading place details...</span> : null}
                {placesError ? <span className="mt-1 block text-sm text-red-300">{placesError}</span> : null}
                {isPlaceSelected ? (
                  <span className="mt-1 block text-xs text-emerald-200/90">
                    Confirmed for Swiss Ephemeris: latitude {birthplace!.lat.toFixed(4)}, longitude {birthplace!.lng.toFixed(4)}.
                  </span>
                ) : null}
                {fieldErrors.birthPlace ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.birthPlace}</span> : null}
              </label>
            </div>

            <label className={labelClassName}>
              Timezone
              <TimezoneSelect
                value={timezone}
                onChange={(value) => {
                  setTimezone(value);
                  setTimezoneSource("user");
                  setFieldErrors((current) => {
                    const next = { ...current };
                    delete next.timezone;
                    return next;
                  });
                }}
                required
                className={fieldClassName}
              />
              <span className="mt-1 block text-xs text-white/45">
                Select the exact IANA timezone for your birth details and scheduling. Place lookup can suggest one, but it will never be applied automatically.
              </span>
              {suggestedTimezone ? (
                <span className="mt-1 block text-xs text-white/45">
                  Suggested timezone: <span className="text-white/75">{suggestedTimezone}</span>{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setTimezone(suggestedTimezone);
                      setTimezoneSource("suggested");
                      setFieldErrors((current) => {
                        const next = { ...current };
                        delete next.timezone;
                        return next;
                      });
                    }}
                    className="text-accent-cyan transition hover:text-accent-cyan/80"
                  >
                    Use this
                  </button>
                </span>
              ) : null}
              {fieldErrors.timezone ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.timezone}</span> : null}
            </label>

            {selectedSessionType === "focus" ? (
              <div>
                <p className="text-sm text-white/70">Topics</p>
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
                {fieldErrors.focusTopics ? <p className="mt-2 text-sm text-red-300">{fieldErrors.focusTopics}</p> : null}
              </div>
            ) : null}

            {selectedSessionType === "mentoring" ? (
              <label className={labelClassName}>
                Goal
                <select
                  className={`${fieldClassName} cursor-pointer`}
                  value={form.mentoringGoal}
                  onChange={(event) => setFormField("mentoringGoal", event.target.value)}
                >
                  <option value="" className="bg-slate-950">Select a goal</option>
                  {MENTORING_GOALS.map((goal) => (
                    <option key={goal} value={goal} className="bg-slate-950">
                      {goal}
                    </option>
                  ))}
                </select>
                {fieldErrors.mentoringGoal ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.mentoringGoal}</span> : null}
              </label>
            ) : null}

            {((selectedSessionType === "focus" && form.focusTopics.includes("Other"))
              || (selectedSessionType === "mentoring" && form.mentoringGoal === "Other")) ? (
                <label className={labelClassName}>
                  Other
                  <input
                    className={fieldClassName}
                    value={form.otherDetail}
                    onChange={(event) => setFormField("otherDetail", event.target.value)}
                    placeholder="Tell us more"
                  />
                  {fieldErrors.otherDetail ? <span className="mt-1 block text-sm text-red-300">{fieldErrors.otherDetail}</span> : null}
                </label>
              ) : null}

            <label className={labelClassName}>
              Additional Notes
              <textarea
                className={fieldClassName}
                rows={5}
                value={form.additionalNotes}
                onChange={(event) => setFormField("additionalNotes", event.target.value)}
                placeholder="Anything else you want us to know before the session."
              />
            </label>

            <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/75">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(event) => setFormField("consentGiven", event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
              />
              <span>
                I consent to sharing this intake information so the session can be prepared and delivered.
                {fieldErrors.consentGiven ? <span className="mt-1 block text-red-300">{fieldErrors.consentGiven}</span> : null}
              </span>
            </label>

          </form>
        </section>
      ) : null}

      {canShowIntake ? (
        <section className="glass-card cosmic-motion mt-6 rounded-2xl p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">4. Purchase</h2>
          <p className="mt-2 text-sm text-white/60">
            Complete your booking by confirming payment.
          </p>
          {purchaseError ? <p className="mt-4 text-sm text-red-300">{purchaseError}</p> : null}
          <button
            type="button"
            disabled={!isPurchaseReady}
            onClick={() => void handlePurchase()}
            className={`${purchaseButtonClassName} mt-6`}
          >
            {isProcessing ? "Processing..." : "Complete & Purchase Session"}
          </button>
        </section>
      ) : null}
    </div>
  );
}
