import { useEffect, useMemo, useState } from "react";
import { useAuth, useUser } from "@clerk/react";
import { motion } from "framer-motion";
import {
  getSuggestedTimezone,
  divin8ReportTierListPrice,
  getReportTierDefinition,
  REPORT_TIER_ORDER,
  type ReportTierId,
} from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import { useLocation, useNavigate } from "react-router-dom";
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
import { startReportCheckout } from "../lib/reportCheckout";

interface ReportFormState {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  birthTime: string;
  birthPlaceInput: string;
  primaryFocus: string;
  notes: string;
  consentGiven: boolean;
}

interface CreateMemberReportResponse {
  success?: boolean;
  reportId?: string;
  requiresPayment?: boolean;
}

interface StoredReportDraft {
  pathname: string;
  form: ReportFormState;
  birthplace: PlaceResult | null;
  timezone: string;
  timezoneSource: "user" | "suggested" | "fallback";
}

const PRIMARY_FOCUS_OPTIONS = [
  { value: "", label: "No specific focus" },
  { value: "purpose", label: "Purpose and direction" },
  { value: "relationships", label: "Relationships" },
  { value: "career", label: "Career and work" },
  { value: "finance", label: "Finance" },
  { value: "health", label: "Health and vitality" },
  { value: "timing", label: "Timing and next season" },
  { value: "spiritual", label: "Spiritual growth" },
];

const REPORT_DRAFT_STORAGE_KEY = "wisdomtransmissions:report-checkout-draft";

function normalizeText(value: string): string {
  return value.trim();
}

function resolveBirthTimeInput(value: string): string {
  const normalized = value.trim();
  return normalized ? normalized.slice(0, 5) : "00:00";
}

function buildInitialFormState(prefill?: Partial<ReportFormState>): ReportFormState {
  return {
    fullName: prefill?.fullName ?? "",
    email: prefill?.email ?? "",
    phone: "",
    birthDate: "",
    birthTime: "00:00",
    birthPlaceInput: "",
    primaryFocus: "",
    notes: "",
    consentGiven: false,
  };
}

function readStoredReportDraft(): StoredReportDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(REPORT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredReportDraft;
  } catch {
    return null;
  }
}

function writeStoredReportDraft(value: StoredReportDraft) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(REPORT_DRAFT_STORAGE_KEY, JSON.stringify(value));
}

function clearStoredReportDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(REPORT_DRAFT_STORAGE_KEY);
}

function resolveTierFromPath(pathname: string): ReportTierId {
  if (pathname.endsWith("/deep-dive")) return "deep_dive";
  if (pathname.endsWith("/initiate")) return "initiate";
  return "intro";
}

function resolvePathFromTier(tier: ReportTierId): string {
  if (tier === "deep_dive") return "/reports/deep-dive";
  if (tier === "initiate") return "/reports/initiate";
  return "/reports";
}

export default function Reports() {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const { user: dbUser } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<ReportTierId>("intro");
  const [form, setForm] = useState<ReportFormState>(() => buildInitialFormState());
  const [birthplace, setBirthplace] = useState<PlaceResult | null>(null);
  const [timezone, setTimezone] = useState("");
  const [timezoneSource, setTimezoneSource] = useState<"user" | "suggested" | "fallback">("user");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [birthTimeEdited, setBirthTimeEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const {
    error: placesError,
    isResolving: resolvingPlace,
    isSearching: searchingPlaces,
    suggestions: placeSuggestions,
    selectSuggestion,
  } = useGooglePlaces(
    form.birthPlaceInput,
    (place) => {
      setBirthplace(place);
      setForm((current) => ({ ...current, birthPlaceInput: place.name }));
      setFieldErrors((current) => {
        const next = { ...current };
        delete next.birthPlace;
        return next;
      });
    },
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
    setSelectedTier(resolveTierFromPath(location.pathname));
  }, [location.pathname]);

  useEffect(() => {
    const stored = readStoredReportDraft();
    if (!stored || stored.pathname !== location.pathname) {
      return;
    }

    setForm(stored.form);
    setBirthplace(stored.birthplace);
    setTimezone(stored.timezone ?? "");
    setTimezoneSource(stored.timezoneSource ?? "user");
    setBirthTimeEdited(stored.form.birthTime !== "00:00");
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;

    async function reconcileCheckoutState() {
      const params = new URLSearchParams(location.search);
      const checkoutState = params.get("checkout");
      const reportId = params.get("reportId");
      const checkoutSessionId = params.get("checkoutSessionId");
      const fallbackEmail = dbUser?.email || clerkUser?.primaryEmailAddress?.emailAddress || "";
      const fallbackFullName = clerkUser?.fullName || "";

      if (checkoutState === "success") {
        try {
          const token = await getToken();
          await syncOwnedCheckoutSession({
            token,
            checkoutSessionId,
            entityType: reportId ? "report" : undefined,
            entityId: reportId,
          });
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "Payment completed, but report fulfillment is still syncing.");
          }
        }

        if (cancelled) {
          return;
        }

        clearStoredReportDraft();
        setBirthplace(null);
        setTimezone("");
        setTimezoneSource("user");
        setBirthTimeEdited(false);
        setForm(buildInitialFormState({
          fullName: fallbackFullName,
          email: fallbackEmail,
        }));
        setError(null);
        setNotice(null);
        setSuccess("Payment confirmed. Your report is now in the fulfillment queue and will appear once it is completed.");
        trackEventOnce(`analytics:report:${reportId ?? "success"}`, "purchase", {
          source: "reports_checkout_success",
          productType: "report",
          tier: selectedTier,
        });
        return;
      }

      if (checkoutState === "canceled" && !cancelled) {
        setSuccess(null);
        setNotice("Checkout canceled. Your pending report is still ready if you want to retry payment.");
        return;
      }

      if (!cancelled) {
        setNotice(null);
      }
    }

    void reconcileCheckoutState();
    return () => {
      cancelled = true;
    };
  }, [clerkUser?.fullName, clerkUser?.primaryEmailAddress?.emailAddress, dbUser?.email, getToken, location.search, selectedTier]);

  const selectedTierDefinition = useMemo(
    () => getReportTierDefinition(selectedTier),
    [selectedTier],
  );

  const isPlaceSelected = Boolean(
    birthplace
      && birthplace.name === form.birthPlaceInput
      && Number.isFinite(birthplace.lat)
      && Number.isFinite(birthplace.lng),
  );
  const suggestedTimezone = useMemo(
    () =>
      getSuggestedTimezone({
        latitude: birthplace?.lat,
        longitude: birthplace?.lng,
        timezone: birthplace?.timezone,
      }),
    [birthplace?.lat, birthplace?.lng, birthplace?.timezone],
  );

  function setFormField<K extends keyof ReportFormState>(field: K, value: ReportFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleBirthplaceInputChange(value: string) {
    setForm((current) => ({ ...current, birthPlaceInput: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next.birthPlace;
      return next;
    });
    if (!birthplace || value !== birthplace.name) {
      setBirthplace(null);
    }
  }

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

  function validateReportChoiceStep() {
    return createValidationResult();
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
    if (!isPlaceSelected) nextErrors.birthPlace = "Please choose your birthplace from the list so we can prepare the report accurately.";
    if (!timezone) nextErrors.timezone = requiredStepMessage("Your timezone");
    return createValidationResult(nextErrors);
  }

  function validateIntentStep() {
    return createValidationResult();
  }

  function validateOptionalStep() {
    return createValidationResult();
  }

  function validateReviewStep() {
    const nextErrors: ValidationErrors = {};
    if (!form.consentGiven) {
      nextErrors.consentGiven = "Please confirm these details so your report can move into preparation.";
    }
    return createValidationResult(nextErrors);
  }

  function validateForm() {
    const nextErrors: ValidationErrors = {
      ...validateBasicInfoStep().errors,
      ...validateBirthDetailsStep().errors,
      ...validateReviewStep().errors,
    };
    return nextErrors;
  }

  function handleFieldBlur(field: "fullName" | "email" | "phone" | "birthDate" | "birthPlace" | "timezone") {
    const validators: Record<typeof field, () => string | undefined> = {
      fullName: () => (normalizeText(form.fullName) ? undefined : requiredStepMessage("Your full name")),
      email: () => (normalizeText(form.email) ? undefined : requiredStepMessage("Your email")),
      phone: () => (normalizeText(form.phone) ? undefined : requiredStepMessage("Your phone number")),
      birthDate: () => (normalizeText(form.birthDate) ? undefined : requiredStepMessage("Your birth date")),
      birthPlace: () => (isPlaceSelected ? undefined : "Please choose your birthplace from the list so we can prepare the report accurately."),
      timezone: () => (timezone ? undefined : requiredStepMessage("Your timezone")),
    };
    setSingleFieldError(field, validators[field]());
  }

  async function handlePurchase() {
    setError(null);
    setSuccess(null);
    setNotice(null);

    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || !birthplace) {
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      writeStoredReportDraft({
        pathname: resolvePathFromTier(selectedTier),
        form,
        birthplace,
        timezone,
        timezoneSource,
      });

      const response = (await api.post(
        "/member/reports",
        {
          tier: selectedTier,
          fullName: normalizeText(form.fullName),
          email: normalizeText(form.email),
          phone: normalizeText(form.phone),
          birthDate: form.birthDate,
          birthTime: resolveBirthTimeInput(form.birthTime),
          birthPlaceName: birthplace.name,
          birthLat: birthplace.lat,
          birthLng: birthplace.lng,
          birthTimezone: timezone,
          timezoneSource,
          primaryFocus: normalizeText(form.primaryFocus) || undefined,
          consentGiven: form.consentGiven,
          notes: normalizeText(form.notes) || undefined,
        },
        token,
      )) as CreateMemberReportResponse;

      const reportId = typeof response?.reportId === "string" ? response.reportId.trim() : "";
      if (!reportId) {
        throw new Error("Report checkout could not be created locally before Stripe redirect.");
      }

      await startReportCheckout(reportId, { token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit your report request.");
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClassName =
    "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 pr-10 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";

  const reviewSections = useMemo(
    () => [
      {
        id: "report-choice",
        title: "Report Choice",
        items: [
          { label: "Tier", value: selectedTierDefinition.label },
          { label: "Price", value: divin8ReportTierListPrice(selectedTier) },
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
          { label: "Birthplace", value: form.birthPlaceInput || "Not provided yet" },
          { label: "Timezone", value: timezone || "Not selected yet" },
        ],
      },
      {
        id: "report-intent",
        title: "Report Intent",
        items: [
          {
            label: "Primary Focus",
            value: PRIMARY_FOCUS_OPTIONS.find((option) => option.value === form.primaryFocus)?.label ?? "No specific focus",
          },
        ],
      },
      {
        id: "optional-inputs",
        title: "Optional Inputs",
        items: [
          { label: "Additional Notes", value: normalizeText(form.notes) || "None added" },
          { label: "Consent", value: form.consentGiven ? "Confirmed" : "Please confirm before purchase" },
        ],
      },
    ],
    [
      form.birthDate,
      form.birthPlaceInput,
      form.birthTime,
      form.consentGiven,
      form.email,
      form.fullName,
      form.notes,
      form.phone,
      form.primaryFocus,
      selectedTier,
      selectedTierDefinition.label,
      timezone,
    ],
  );

  const steps = useMemo<StepConfig<ReportFormState>[]>(
    () => [
      {
        id: "report-choice",
        title: "Choose your report",
        guidance: "Pick the report that feels right for what you want to explore. Once you choose, we'll guide the details calmly from there.",
        validate: validateReportChoiceStep,
        isComplete: () => true,
        render: () => (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/12 text-amber-200">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M2 12h12L13 5l-3 3-2-4-2 4-3-3-1 7z" fill="currentColor" />
                    <rect x="2" y="12" width="12" height="2" rx="0.5" fill="currentColor" />
                  </svg>
                </span>
                <div>
                  <h3 className="text-base font-semibold text-white">{selectedTierDefinition.label}</h3>
                  <p className="text-sm text-white/55">{divin8ReportTierListPrice(selectedTier)}</p>
                </div>
              </div>
              <p className="mt-4 text-sm text-white/65">{selectedTierDefinition.description}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {REPORT_TIER_ORDER.map((tier) => {
                const definition = getReportTierDefinition(tier);
                const active = selectedTier === tier;
                return (
                  <motion.button
                    key={tier}
                    type="button"
                    onClick={() => {
                      setSelectedTier(tier);
                      navigate(resolvePathFromTier(tier));
                    }}
                    whileTap={{ scale: 0.99 }}
                    animate={active ? { scale: 1.03 } : { scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className={`relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition ${
                      active
                        ? "border-amber-300/60 bg-cyan-400/10 text-white shadow-[0_0_24px_rgba(34,211,238,0.14)]"
                        : "border-white/10 bg-white/5 text-white hover:border-white/25"
                    }`}
                  >
                    {active ? (
                      <span className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(250,204,21,0.12),transparent_60%)]" />
                    ) : null}
                    <div className="relative">
                      <p className="text-base font-semibold">{definition.label}</p>
                      <p className="mt-2 text-sm font-medium text-amber-200/90">{divin8ReportTierListPrice(tier)}</p>
                      <p className="mt-3 text-sm leading-6 text-white/60">{definition.description}</p>
                    </div>
                  </motion.button>
                );
              })}
            </div>

            <div className="rounded-xl border border-cyan-300/20 bg-cyan-400/5 px-4 py-4 text-sm text-cyan-100">
              Great choice. Let's get this set up for you.
            </div>
          </div>
        ),
      },
      {
        id: "basic-info",
        title: "Basic info",
        guidance: "Let's start with a few simple contact details so everything stays connected to you.",
        validate: validateBasicInfoStep,
        isComplete: (state) => Boolean(normalizeText(state.fullName) && normalizeText(state.email) && normalizeText(state.phone)),
        render: () => (
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              label="Full Name"
              htmlFor="report-full-name"
              helperText="Use the full name you'd like attached to the report."
              errorText={fieldErrors.fullName}
              isComplete={Boolean(normalizeText(form.fullName))}
            >
              <input
                id="report-full-name"
                className={fieldClassName}
                value={form.fullName}
                onChange={(event) => setFormField("fullName", event.target.value)}
                onBlur={() => handleFieldBlur("fullName")}
                placeholder="Your full name"
              />
            </FormField>

            <FormField
              label="Email"
              htmlFor="report-email"
              helperText="We'll use the email on your account for updates and delivery."
              errorText={fieldErrors.email}
              isComplete={Boolean(normalizeText(form.email))}
            >
              <input
                id="report-email"
                className={fieldClassName}
                type="email"
                readOnly
                value={form.email}
                onBlur={() => handleFieldBlur("email")}
              />
            </FormField>

            <FormField
              label="Phone Number"
              htmlFor="report-phone"
              helperText="This helps us reach you if we need to clarify anything quickly."
              errorText={fieldErrors.phone}
              isComplete={Boolean(normalizeText(form.phone))}
              className="md:col-span-2"
            >
              <input
                id="report-phone"
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
        guidance: "Enter your birth details carefully. If you don't know your birth time, you can leave the default in place and continue.",
        validate: validateBirthDetailsStep,
        isComplete: () => Boolean(normalizeText(form.birthDate) && isPlaceSelected && timezone),
        render: () => (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                label="Birthdate"
                htmlFor="report-birth-date"
                helperText="This gives the report its foundation."
                errorText={fieldErrors.birthDate}
                isComplete={Boolean(normalizeText(form.birthDate))}
              >
                <input
                  id="report-birth-date"
                  className={fieldClassName}
                  type="date"
                  value={form.birthDate}
                  onChange={(event) => setFormField("birthDate", event.target.value)}
                  onBlur={() => handleFieldBlur("birthDate")}
                />
              </FormField>

              <FormField
                label="Birthtime"
                htmlFor="report-birth-time"
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
                  id="report-birth-time"
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
                htmlFor="report-birth-place"
                helperText="Start typing and choose the right birthplace from the list."
                errorText={placesError || fieldErrors.birthPlace}
                isComplete={isPlaceSelected}
              >
                <div>
                  <input
                    id="report-birth-place"
                    className={fieldClassName}
                    value={form.birthPlaceInput}
                    onChange={(event) => handleBirthplaceInputChange(event.target.value)}
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
                </div>
              </FormField>

              <FormField
                label="Timezone"
                helperText="This helps us align the report accurately with your birth details."
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
      {
        id: "report-intent",
        title: "Report intent",
        guidance: "If you'd like, choose a primary focus so we can better tune into what matters most for you.",
        validate: validateIntentStep,
        isComplete: () => true,
        render: () => (
          <FormField
            label="Primary Focus"
            helperText="Optional - include if relevant. This helps us better tune into your situation."
            optional
            isComplete={Boolean(normalizeText(form.primaryFocus))}
          >
            <select
              value={form.primaryFocus}
              onChange={(event) => setFormField("primaryFocus", event.target.value)}
              className={`${fieldClassName} cursor-pointer`}
            >
              {PRIMARY_FOCUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value} className="bg-slate-950">
                  {option.label}
                </option>
              ))}
            </select>
          </FormField>
        ),
      },
      {
        id: "optional-inputs",
        title: "Optional inputs",
        guidance: "You're almost done. Add any notes that feel relevant, or continue if you'd rather keep it simple.",
        validate: validateOptionalStep,
        isComplete: () => true,
        render: () => (
          <FormField
            label="Additional Notes"
            htmlFor="report-notes"
            helperText="Optional - include if relevant."
            optional
            isComplete={Boolean(normalizeText(form.notes))}
          >
            <textarea
              id="report-notes"
              className={`${fieldClassName} min-h-[132px]`}
              value={form.notes}
              onChange={(event) => setFormField("notes", event.target.value)}
              placeholder="Anything helpful to know before preparing your report"
            />
          </FormField>
        ),
      },
      {
        id: "review",
        title: "Review and confirm",
        guidance: "Everything looks good. You're ready to proceed.",
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

            <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
              <input
                type="checkbox"
                checked={form.consentGiven}
                onChange={(event) => {
                  setFormField("consentGiven", event.target.checked);
                  if (event.target.checked) {
                    setSingleFieldError("consentGiven");
                  }
                }}
                className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent text-accent-cyan"
              />
              <span>
                I confirm these details are accurate and consent to using this intake for report preparation.
                {fieldErrors.consentGiven ? <span className="mt-1 block text-amber-200">{fieldErrors.consentGiven}</span> : null}
              </span>
            </label>
          </div>
        ),
      },
    ],
    [
      fieldErrors.birthDate,
      fieldErrors.birthPlace,
      fieldErrors.consentGiven,
      fieldErrors.email,
      fieldErrors.fullName,
      fieldErrors.phone,
      fieldErrors.timezone,
      form,
      isPlaceSelected,
      navigate,
      placeSuggestions,
      resolvingPlace,
      searchingPlaces,
      selectedTier,
      selectedTierDefinition,
      suggestedTimezone,
      timezone,
    ],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-white">Reports</h1>
        <p className="mt-3 max-w-2xl text-sm text-white/65">
          Order your Divin8 report. Complete the intake below - your report will be delivered within 48 hours.
        </p>
      </header>

      <section className="glass-card rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/50">Buy Report</h2>
              <p className="mt-2 text-sm text-white/60">
                Choose your tier, complete the intake, and submit your report purchase in one focused flow.
              </p>
            </div>
            <div className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-1 text-xs font-medium text-amber-100">
              48-hour delivery
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-amber-300/12 text-amber-200">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M2 12h12L13 5l-3 3-2-4-2 4-3-3-1 7z" fill="currentColor" />
                  <rect x="2" y="12" width="12" height="2" rx="0.5" fill="currentColor" />
                </svg>
              </span>
              <div>
                <h3 className="text-base font-semibold text-white">{selectedTierDefinition.label}</h3>
                <p className="text-sm text-white/55">{divin8ReportTierListPrice(selectedTier)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm text-white/65">{selectedTierDefinition.description}</p>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-950/35 px-4 py-4 text-sm text-emerald-100">
              {success}
            </div>
          ) : null}

          {notice ? (
            <div className="rounded-xl border border-amber-400/25 bg-amber-950/35 px-4 py-4 text-sm text-amber-100">
              {notice}
            </div>
          ) : null}

          <FormStepper
            steps={steps}
            state={form}
            resetKey={location.pathname}
            onValidationErrors={setFieldErrors}
            onComplete={handlePurchase}
            completeLabel="Purchase Report"
            isSubmitting={submitting}
            submitError={error}
            footerStart={(
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5"
              >
                &larr; Back to Dashboard
              </button>
            )}
          />
        </div>
      </section>
    </div>
  );
}
