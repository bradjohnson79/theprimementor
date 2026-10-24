import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { findTimezoneOption, getBrowserTimezoneName } from "@wisdom/utils";
import TimezoneSelect from "@wisdom/ui/timezone-select";
import SessionIntakeImageField from "../components/bookings/SessionIntakeImageField";
import FormField from "../components/forms/FormField";
import { useGooglePlaces, type PlaceResult } from "../hooks/useGooglePlaces";
import { usePageMeta } from "../hooks/usePageMeta";
import {
  fetchGuestIntake,
  guestIntakePath,
  submitGuestIntake,
  uploadGuestIntakeImage,
  type GuestIntakeView,
} from "../lib/guestIntake";
import {
  AVAILABILITY_DAYS,
  AVAILABILITY_DAY_LABELS,
  AVAILABILITY_SLOTS,
  MENTORING_GOALS,
  createEmptyAvailabilitySelection,
  type AvailabilityDay,
  type AvailabilitySelection,
} from "./bookings.constants";

/**
 * Guest Services Intake Form (no sign-in). Reached from the thank-you page or the purchase
 * email after a pay-first guest checkout for Q&A, Mentoring, Prime Body Healing, offline
 * sessions or the Manifestation Monthly Package. Same fields and rules as the signed-in
 * booking forms; the order's email is fixed, and the link is single-use.
 */

const FIELD_CLASS =
  "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/40 focus:border-accent-cyan/50 focus:outline-none focus:ring-1 focus:ring-accent-cyan/30";
const QUESTION_LIMIT = 1000;
const NOTE_LIMIT = 2000;
const PBH_LEVEL_2_ID = "prime-body-healing-level-2";
const PBH_PRERECORDED_ID = "prime-body-healing-level-1-prerecorded";
const RECIPIENTS = [
  { value: "brad_johnson", label: "Brad Johnson" },
  { value: "adronis", label: "Adronis" },
  { value: "brad_and_adronis", label: "Brad & Adronis" },
] as const;

function browserTimezone() {
  return findTimezoneOption(getBrowserTimezoneName())?.ianaName ?? "UTC";
}

function formatSlot(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

function Section({ title, children, hint }: { title: string; children: ReactNode; hint?: string }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-medium text-white">{title}</h2>
        {hint ? <p className="mt-1 text-sm text-white/55">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function GuestIntakeStatusPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center text-white">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="mt-4 space-y-3 text-white/65">{children}</div>
    </main>
  );
}

export default function GuestServicesIntakePage() {
  const { token = "" } = useParams();
  const [view, setView] = useState<GuestIntakeView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  usePageMeta({
    title: "Services Intake Form | The Prime Mentor",
    description: "Complete your intake so your session is ready to book.",
    canonical: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchGuestIntake(token)
      .then((next) => { if (!cancelled) setView(next); })
      .catch((error: Error) => { if (!cancelled) setLoadError(error.message || "This link has expired or is no longer valid."); });
    return () => { cancelled = true; };
  }, [token]);

  if (loadError) {
    return (
      <GuestIntakeStatusPage title="This link has expired or is no longer valid">
        <p>Use the most recent link in your confirmation email, or open your order page to get a fresh one.</p>
        <p>Still stuck? <Link to="/contact" className="underline">Contact us</Link>.</p>
      </GuestIntakeStatusPage>
    );
  }
  if (!view) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </main>
    );
  }
  if (view.kind !== "services") {
    return (
      <GuestIntakeStatusPage title="This link is for the Divin8 Reports Intake Form">
        <p>Your order is a Divin8 Report, so it uses the reports form.</p>
        <Link to={guestIntakePath("reports", token)} className="mt-4 inline-flex rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-slate-950">
          Open the Divin8 Reports Intake Form
        </Link>
      </GuestIntakeStatusPage>
    );
  }
  if (done || view.intakeStatus === "submitted") {
    return (
      <GuestIntakeStatusPage title={done ? "Thank you — we have your intake form" : "We already have your intake form"}>
        <p>Everything is ready for {view.productLabel}. We'll be in touch by email to arrange the next step.</p>
        <p className="text-sm">Need to change something? Reply to your confirmation email or <Link to="/contact" className="underline">contact us</Link>.</p>
      </GuestIntakeStatusPage>
    );
  }
  return <ServicesIntakeForm token={token} view={view} onDone={() => setDone(true)} />;
}

function ServicesIntakeForm({ token, view, onDone }: { token: string; view: GuestIntakeView; onDone: () => void }) {
  const session = view.session!;
  const sessionType = session.sessionType;
  const isQA = sessionType === "qa_session";
  const isMentoring = sessionType === "mentoring";
  const isRegeneration = sessionType === "regeneration";
  const isPBH = sessionType === "prime_body_healing";
  const isPBHLevel2 = isPBH && session.bookingTypeId === PBH_LEVEL_2_ID;
  const isEmailSession = sessionType === "email_session";
  const isPastLife = sessionType === "past_life_akashic";

  const [fullName, setFullName] = useState(view.fullName ?? "");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [phone, setPhone] = useState("");
  const [timezone, setTimezone] = useState(browserTimezone);
  const [availability, setAvailability] = useState<AvailabilitySelection>(createEmptyAvailabilitySelection);
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [birthPlace, setBirthPlace] = useState("");
  const [selectedPlace, setSelectedPlace] = useState<PlaceResult | null>(null);
  const [qaTopics, setQaTopics] = useState("");
  const [goals, setGoals] = useState<string[]>([]);
  const [otherDetail, setOtherDetail] = useState("");
  const [manifestationIntention, setManifestationIntention] = useState("");
  const [manifestationFeeling, setManifestationFeeling] = useState("");
  const [manifestationAssumptions, setManifestationAssumptions] = useState("");
  const [areas, setAreas] = useState(["", "", "", "", ""]);
  const [concerns, setConcerns] = useState("");
  const [recipient, setRecipient] = useState<(typeof RECIPIENTS)[number]["value"]>("brad_johnson");
  const [questions, setQuestions] = useState(["", "", ""]);
  const [preparatoryNote, setPreparatoryNote] = useState("");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState(""); // honeypot
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const places = useGooglePlaces(birthPlace, (place) => {
    setSelectedPlace(place);
    setBirthPlace(place.name);
  });

  const selectedSlotCount = useMemo(
    () => AVAILABILITY_DAYS.reduce((total, day) => total + availability[day].length, 0),
    [availability],
  );

  function toggleSlot(day: AvailabilityDay, time: string) {
    setAvailability((current) => ({
      ...current,
      [day]: current[day].includes(time) ? current[day].filter((slot) => slot !== time) : [...current[day], time],
    }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!fullName.trim()) next.fullName = "Please enter your full name.";
    if (session.requiresPhone && !phone.trim()) next.phone = "Please add a phone number.";
    if (!birthDate) next.birthDate = "Please add your birth date.";
    if (!selectedPlace || selectedPlace.name !== birthPlace.trim()) next.birthPlace = "Start typing and choose your birthplace from the list.";
    if (!timezone) next.timezone = "Choose your timezone.";
    if (session.requiresAvailability && selectedSlotCount === 0) next.availability = "Select at least one time that works for you.";
    if (isQA && qaTopics.length > 2000) next.qaTopics = "Please keep this under 2000 characters.";
    if (isMentoring && goals.length === 0) next.goals = "Choose at least one goal.";
    if (isMentoring && goals.includes("Other") && !otherDetail.trim()) next.otherDetail = "Tell us a little about your other goal.";
    if (isRegeneration) {
      if (!manifestationIntention.trim()) next.manifestationIntention = "Share the manifestation you want to work with.";
      if (!manifestationFeeling.trim()) next.manifestationFeeling = "Share how you want to feel.";
      if (!manifestationAssumptions.trim()) next.manifestationAssumptions = "Share the assumptions or challenges you want to discuss.";
    }
    if (isPBH && !isPBHLevel2 && !areas[0].trim()) next.areas = "Please add at least one area to work on.";
    if (isPBHLevel2 && !concerns.trim()) next.concerns = "Please share the concerns you would most like examined.";
    if (isEmailSession) {
      if (!questions[0].trim()) next.question1 = "Please add your first question.";
      if (questions.some((question) => question.trim().length > QUESTION_LIMIT)) next.question1 = `Each question must be ${QUESTION_LIMIT} characters or fewer.`;
    }
    if (isPastLife && preparatoryNote.trim().length > NOTE_LIMIT) next.preparatoryNote = `Please keep this under ${NOTE_LIMIT} characters.`;
    if (!consent) next.consent = "Please confirm these details so we can move forward with your session.";
    return next;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setMessage(null);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setMessage("Please complete the highlighted fields.");
      return;
    }
    setSubmitting(true);
    try {
      const clientImage = photo ? await uploadGuestIntakeImage(token, photo) : undefined;
      const place = selectedPlace!;
      const intake: Record<string, unknown> = { type: sessionType, gender };
      if (clientImage) intake.clientImage = clientImage;
      if (isQA && qaTopics.trim()) intake.topics = qaTopics.trim();
      if (isMentoring) {
        intake.goals = goals;
        if (otherDetail.trim()) intake.other = otherDetail.trim();
      }
      if (isRegeneration) {
        intake.manifestationIntention = manifestationIntention.trim();
        intake.manifestationFeeling = manifestationFeeling.trim();
        intake.manifestationAssumptions = manifestationAssumptions.trim();
        intake.healthFocusAreas = [{ name: manifestationIntention.trim(), severity: 10 }];
      }
      if (isPBH) {
        Object.assign(intake, {
          deliveryFormat: isPBHLevel2 ? "scan" : session.bookingTypeId === PBH_PRERECORDED_ID ? "prerecorded" : "live",
          healingAreas: isPBHLevel2 ? [] : areas.map((area) => area.trim()).filter(Boolean).slice(0, 5),
          concerns: isPBHLevel2 ? concerns.trim() : undefined,
          notes: notes.trim() || undefined,
          birthDate,
          birthTime: birthTime || undefined,
          birthPlace: place.name,
        });
      }
      if (isEmailSession) {
        Object.assign(intake, {
          questionRecipient: recipient,
          question1: questions[0].trim(),
          question2: questions[1].trim() || undefined,
          question3: questions[2].trim() || undefined,
        });
      }
      if (isPastLife) intake.preparatoryNote = preparatoryNote.trim() || undefined;

      await submitGuestIntake(token, {
        kind: "services",
        website: website || undefined,
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        gender,
        timezone,
        timezoneSource: "user",
        availability: session.requiresAvailability ? availability : undefined,
        birthDate,
        birthTime: birthTime || undefined,
        birthPlace: place.name,
        birthPlaceName: place.name,
        birthLat: place.lat,
        birthLng: place.lng,
        birthTimezone: place.timezone || timezone,
        consentGiven: true,
        notes: isQA ? undefined : notes.trim() || undefined,
        intake,
      });
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We couldn't save your intake form. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 text-white">
      <section className="glass-card rounded-3xl p-6 sm:p-8">
        <p className="text-xs font-medium uppercase tracking-[0.24em] text-accent-cyan">Services Intake Form</p>
        <h1 className="mt-3 text-3xl font-semibold">{view.productLabel}</h1>
        <p className="mt-3 text-sm leading-7 text-white/70">
          Thank you for your purchase. Share these details once and your session is ready to book. No account needed.
        </p>
        {view.paymentStatus !== "paid" ? (
          <p className="mt-2 text-xs text-amber-100/80">Your payment is still being confirmed — you can fill this in now.</p>
        ) : null}
      </section>

      <form onSubmit={(event) => void handleSubmit(event)} noValidate className="glass-card mt-6 space-y-10 rounded-3xl p-6 sm:p-8">
        <Section title="Your details">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full Name" htmlFor="gi-name" errorText={errors.fullName} isComplete={Boolean(fullName.trim())}>
              <input id="gi-name" className={FIELD_CLASS} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
            </FormField>
            <FormField label="Email" htmlFor="gi-email" helperText="Your order email. Contact us if this needs to change." isComplete>
              <input id="gi-email" className={`${FIELD_CLASS} opacity-75`} value={view.email ?? ""} readOnly />
            </FormField>
            <FormField label="Gender" htmlFor="gi-gender" helperText="Used so a name is not interpreted more than one way." isComplete>
              <select id="gi-gender" className={`${FIELD_CLASS} bg-white text-slate-900`} value={gender} onChange={(e) => setGender(e.target.value as "male" | "female")}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </FormField>
            <FormField label="Phone Number" htmlFor="gi-phone" optional={!session.requiresPhone} helperText={session.requiresPhone ? undefined : "Optional."} errorText={errors.phone} isComplete={Boolean(phone.trim())}>
              <input id="gi-phone" className={FIELD_CLASS} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </FormField>
          </div>
        </Section>

        {session.requiresAvailability ? (
          <Section title="Availability" hint="This does not confirm a specific booking time. Your session will be personally scheduled based on what you select here.">
            <div className="space-y-5">
              {AVAILABILITY_DAYS.map((day) => (
                <div key={day} className="space-y-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-white/55">{AVAILABILITY_DAY_LABELS[day]}</h3>
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {AVAILABILITY_SLOTS[day].map((time) => {
                      const active = availability[day].includes(time);
                      return (
                        <label
                          key={`${day}-${time}`}
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition ${
                            active ? "border-accent-cyan/60 bg-accent-cyan/10 text-white" : "border-white/10 bg-white/5 text-white/70 hover:border-white/20"
                          }`}
                        >
                          <input type="checkbox" checked={active} onChange={() => toggleSlot(day, time)} className="h-4 w-4" />
                          <span className="font-medium">{formatSlot(time)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {errors.availability ? <p className="text-xs text-rose-200">{errors.availability}</p> : null}
          </Section>
        ) : null}

        <Section title="Birth details" hint="These anchor your session to your core timing.">
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Birthdate" htmlFor="gi-birthdate" errorText={errors.birthDate} isComplete={Boolean(birthDate)}>
              <input id="gi-birthdate" type="date" className={FIELD_CLASS} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
            </FormField>
            <FormField label="Birth time" htmlFor="gi-birthtime" optional helperText="Optional. An exact time is not required.">
              <input id="gi-birthtime" type="time" className={FIELD_CLASS} value={birthTime} onChange={(e) => setBirthTime(e.target.value)} />
            </FormField>
            <FormField label="Place of birth" htmlFor="gi-birthplace" helperText="Start typing and choose your birthplace from the list." errorText={errors.birthPlace ?? places.error ?? undefined} isComplete={Boolean(selectedPlace)} className="md:col-span-2">
              <div>
                <input
                  id="gi-birthplace"
                  className={FIELD_CLASS}
                  value={birthPlace}
                  onChange={(e) => { setBirthPlace(e.target.value); setSelectedPlace(null); }}
                  placeholder="Start typing and select your birthplace"
                  autoComplete="off"
                  required
                />
                {places.suggestions.length > 0 ? (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-slate-950/95">
                    {places.suggestions.map((suggestion) => (
                      <button
                        key={suggestion.placeId}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => void places.selectSuggestion(suggestion)}
                        className="block w-full border-b border-white/5 px-4 py-3 text-left text-sm text-white/75 last:border-b-0 hover:bg-white/5 hover:text-white"
                      >
                        <span className="block font-medium text-white">{suggestion.primaryText}</span>
                        {suggestion.secondaryText ? <span className="mt-1 block text-xs text-white/45">{suggestion.secondaryText}</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}
                {places.isSearching || places.isResolving ? <span className="mt-2 block text-xs text-white/45">Looking up places…</span> : null}
              </div>
            </FormField>
            <FormField label="Your timezone" htmlFor="gi-timezone" helperText="Where you'll be for the session (look for your UTC/GMT offset if unsure)." errorText={errors.timezone} isComplete={Boolean(timezone)} className="md:col-span-2">
              <TimezoneSelect value={timezone} onChange={(value) => setTimezone(value)} required className={FIELD_CLASS} autoSelectBrowserTimezone={false} />
            </FormField>
          </div>
        </Section>

        {isQA ? (
          <Section title="Your questions" hint="Optional. Share the topics or questions you'd like to explore.">
            <textarea className={`${FIELD_CLASS} min-h-32`} maxLength={2000} value={qaTopics} onChange={(e) => setQaTopics(e.target.value)} aria-label="Q&A topics" />
            {errors.qaTopics ? <p className="text-xs text-rose-200">{errors.qaTopics}</p> : null}
          </Section>
        ) : null}

        {isMentoring ? (
          <Section title="Your goals" hint="Choose up to three.">
            <div className="grid gap-2 sm:grid-cols-2">
              {MENTORING_GOALS.map((goal) => {
                const checked = goals.includes(goal);
                return (
                  <label key={goal} className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm ${checked ? "border-accent-cyan/60 bg-accent-cyan/10" : "border-white/10 bg-white/5 text-white/75"}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && goals.length >= 3}
                      onChange={() => setGoals((current) => (checked ? current.filter((g) => g !== goal) : [...current, goal]))}
                    />
                    {goal}
                  </label>
                );
              })}
            </div>
            {errors.goals ? <p className="text-xs text-rose-200">{errors.goals}</p> : null}
            {goals.includes("Other") ? (
              <FormField label="Tell us about your other goal" htmlFor="gi-other" errorText={errors.otherDetail}>
                <textarea id="gi-other" className={`${FIELD_CLASS} min-h-24`} value={otherDetail} onChange={(e) => setOtherDetail(e.target.value)} />
              </FormField>
            ) : null}
          </Section>
        ) : null}

        {isRegeneration ? (
          <Section title="Your manifestation">
            <FormField label="Manifestation Request" htmlFor="gi-intention" helperText="The manifestation you want to work with this month." errorText={errors.manifestationIntention}>
              <textarea id="gi-intention" className={`${FIELD_CLASS} min-h-24`} value={manifestationIntention} onChange={(e) => setManifestationIntention(e.target.value)} />
            </FormField>
            <FormField label="How do you want to feel once it has manifested?" htmlFor="gi-feeling" errorText={errors.manifestationFeeling}>
              <textarea id="gi-feeling" className={`${FIELD_CLASS} min-h-24`} value={manifestationFeeling} onChange={(e) => setManifestationFeeling(e.target.value)} />
            </FormField>
            <FormField label="Assumptions or challenges you want to discuss" htmlFor="gi-assumptions" errorText={errors.manifestationAssumptions}>
              <textarea id="gi-assumptions" className={`${FIELD_CLASS} min-h-24`} value={manifestationAssumptions} onChange={(e) => setManifestationAssumptions(e.target.value)} />
            </FormField>
          </Section>
        ) : null}

        {isPBH && !isPBHLevel2 ? (
          <Section title="Areas to work on" hint="Physical areas, emotional concerns, energetic imbalances, recurring patterns or anything else you feel needs attention. Only the first is required.">
            <div className="space-y-2">
              {areas.map((area, index) => (
                <input
                  key={index}
                  className={FIELD_CLASS}
                  value={area}
                  onChange={(e) => setAreas((current) => current.map((value, i) => (i === index ? e.target.value : value)))}
                  placeholder={`Area ${index + 1}${index === 0 ? "" : " (optional)"}`}
                  aria-label={`Healing area ${index + 1}`}
                />
              ))}
            </div>
            {errors.areas ? <p className="text-xs text-rose-200">{errors.areas}</p> : null}
          </Section>
        ) : null}

        {isPBHLevel2 ? (
          <Section title="Current concerns">
            <textarea className={`${FIELD_CLASS} min-h-28`} value={concerns} onChange={(e) => setConcerns(e.target.value)} placeholder="What would you most like examined?" aria-label="Current concerns" />
            {errors.concerns ? <p className="text-xs text-rose-200">{errors.concerns}</p> : null}
          </Section>
        ) : null}

        {isEmailSession ? (
          <Section title="Your questions">
            <FormField label="Who would you like your questions addressed to?" htmlFor="gi-recipient" isComplete>
              <select id="gi-recipient" className={`${FIELD_CLASS} bg-white text-slate-900`} value={recipient} onChange={(e) => setRecipient(e.target.value as typeof recipient)}>
                {RECIPIENTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </FormField>
            {questions.map((question, index) => (
              <FormField key={index} label={`Question ${index + 1}`} htmlFor={`gi-q${index + 1}`} optional={index > 0} errorText={index === 0 ? errors.question1 : undefined}>
                <textarea
                  id={`gi-q${index + 1}`}
                  className={`${FIELD_CLASS} min-h-24`}
                  maxLength={QUESTION_LIMIT}
                  value={question}
                  onChange={(e) => setQuestions((current) => current.map((value, i) => (i === index ? e.target.value : value)))}
                />
              </FormField>
            ))}
          </Section>
        ) : null}

        {isPastLife ? (
          <Section title="Before your reading">
            <FormField label="Anything you would like Brad to know before the reading?" htmlFor="gi-prep" optional errorText={errors.preparatoryNote}>
              <textarea id="gi-prep" className={`${FIELD_CLASS} min-h-28`} maxLength={NOTE_LIMIT} value={preparatoryNote} onChange={(e) => setPreparatoryNote(e.target.value)} />
            </FormField>
          </Section>
        ) : null}

        <Section title="Optional">
          {!isQA ? (
            <FormField label="Additional notes" htmlFor="gi-notes" optional>
              <textarea id="gi-notes" className={`${FIELD_CLASS} min-h-24`} maxLength={NOTE_LIMIT} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </FormField>
          ) : null}
          <SessionIntakeImageField id="gi-photo" file={photo} onChange={setPhoto} />
        </Section>

        {/* Honeypot: hidden from people, tempting for bots. */}
        <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-0 w-0 overflow-hidden">
          <label htmlFor="gi-website">Website</label>
          <input id="gi-website" type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </div>

        <section>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/75">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I confirm these details are accurate and consent to having them used to prepare my session.</span>
          </label>
          {errors.consent ? <p className="mt-2 text-xs text-rose-200">{errors.consent}</p> : null}
        </section>

        {message ? <div role="alert" className="rounded-xl border border-rose-400/25 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">{message}</div> : null}

        <div className="flex justify-end">
          <button type="submit" disabled={submitting} className="w-full rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60 sm:w-auto">
            {submitting ? "Saving…" : "Submit intake form"}
          </button>
        </div>
      </form>
    </div>
  );
}
