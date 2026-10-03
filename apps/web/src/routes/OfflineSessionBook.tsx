import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, useUser } from "@clerk/react";
import { getActiveSessionOfferingByBookingTypeId } from "@wisdom/utils";
import SessionIntakeImageField from "../components/bookings/SessionIntakeImageField";
import FormField from "../components/forms/FormField";
import { usePageMeta } from "../hooks/usePageMeta";
import { api } from "../lib/api";
import { trackEvent, trackEventOnce } from "../lib/analytics";
import { startSessionCheckout } from "../lib/sessionCheckout";
import { uploadSessionIntakeImage } from "../lib/uploadSessionIntakeImage";
import {
  EMAIL_SESSION_BOOKING_PATH,
  EMAIL_SESSION_LANDING_PATH,
  PAST_LIFE_AKASHIC_BOOKING_PATH,
  PAST_LIFE_AKASHIC_LANDING_PATH,
} from "../lib/sessionLandingPaths";

type OfflineProduct = "email" | "pastLife";
type Gender = "male" | "female";
type Recipient = "brad_johnson" | "adronis" | "brad_and_adronis";

const QUESTION_LIMIT = 1000;
const NOTE_LIMIT = 2000;

const RECIPIENTS: Array<{ value: Recipient; label: string }> = [
  { value: "brad_johnson", label: "Brad Johnson" },
  { value: "adronis", label: "Adronis" },
  { value: "brad_and_adronis", label: "Brad & Adronis" },
];

const PRODUCTS = {
  email: {
    bookingTypeId: "email-session",
    sessionType: "email_session",
    title: "Email Session",
    landingPath: EMAIL_SESSION_LANDING_PATH,
    bookingPath: EMAIL_SESSION_BOOKING_PATH,
    intro:
      "Ask up to three questions on any topic for Brad or Adronis. Brad completes the session offline and emails a private MP3 when it is ready. No appointment is required.",
  },
  pastLife: {
    bookingTypeId: "past-life-akashic-reading",
    sessionType: "past_life_akashic",
    title: "Past Life Akashic Reading",
    landingPath: PAST_LIFE_AKASHIC_LANDING_PATH,
    bookingPath: PAST_LIFE_AKASHIC_BOOKING_PATH,
    intro:
      "Request an exploration of one past life within your Akashic Records. Brad conducts and interprets the reading privately and emails the completed MP3. No appointment is required.",
  },
} as const;

interface CreateBookingResponse {
  success?: boolean;
  bookingId?: string;
  requiresPayment?: boolean;
  data?: {
    success?: boolean;
    bookingId?: string;
    requiresPayment?: boolean;
  };
}

function priceLabel(bookingTypeId: string) {
  const offering = getActiveSessionOfferingByBookingTypeId(bookingTypeId);
  if (!offering) return "";
  return `${new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: offering.currency,
    maximumFractionDigits: 0,
  }).format(offering.amountCents / 100)} ${offering.currency}`;
}

function recipientLabel(value: Recipient | "") {
  return RECIPIENTS.find((option) => option.value === value)?.label ?? "Not selected";
}

export default function OfflineSessionBook({ product }: { product: OfflineProduct }) {
  const content = PRODUCTS[product];
  const { getToken } = useAuth();
  const { user } = useUser();
  const [step, setStep] = useState<"details" | "review">("details");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [recipient, setRecipient] = useState<Recipient | "">("");
  const [question1, setQuestion1] = useState("");
  const [question2, setQuestion2] = useState("");
  const [question3, setQuestion3] = useState("");
  const [preparatoryNote, setPreparatoryNote] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);
  const [intakeImageFile, setIntakeImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  usePageMeta({
    title: `${content.title} intake | The Prime Mentor`,
    description: content.intro,
    canonical: content.bookingPath,
  });

  useEffect(() => {
    trackEventOnce(`analytics:offline-intake-start:${content.sessionType}`, "offline_intake_start", {
      service_type: content.sessionType,
      service_name: content.title,
      category: "offline",
    });
  }, [content.sessionType, content.title]);

  useEffect(() => {
    const nextName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.fullName || "";
    const nextEmail = user?.primaryEmailAddress?.emailAddress || "";
    if (nextName && !fullName) setFullName(nextName);
    if (nextEmail && !email) setEmail(nextEmail);
  }, [user, fullName, email]);

  const price = priceLabel(content.bookingTypeId);
  const fieldClass = "w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white placeholder:text-white/35 focus:border-cyan-200/50 focus:outline-none";

  function validate() {
    if (!fullName.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    if (!gender) return "Gender is required.";
    if (!consentGiven) return "Consent is required.";
    if (product === "email") {
      if (!recipient) return "Choose who should address your questions.";
      if (!question1.trim()) return "Question 1 is required.";
      if ([question1, question2, question3].some((question) => question.trim().length > QUESTION_LIMIT)) {
        return `Each question must be ${QUESTION_LIMIT} characters or fewer.`;
      }
    }
    if (product === "pastLife" && preparatoryNote.trim().length > NOTE_LIMIT) {
      return `That note must be ${NOTE_LIMIT} characters or fewer.`;
    }
    return null;
  }

  function continueToReview(event: FormEvent) {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (validationError) return;
    trackEventOnce(`analytics:offline-intake-complete:${content.sessionType}`, "offline_intake_complete", {
      service_type: content.sessionType,
      service_name: content.title,
      category: "offline",
    });
    setStep("review");
  }

  async function purchase() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      setStep("details");
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const token = await getToken();
      const clientImage = intakeImageFile
        ? await uploadSessionIntakeImage(intakeImageFile, token)
        : undefined;
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const payload = {
        bookingTypeId: content.bookingTypeId,
        sessionType: content.sessionType,
        timezone,
        timezoneSource: "user" as const,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        gender,
        birthDate: birthDate || undefined,
        consentGiven: true,
        intake: {
          type: content.sessionType,
          gender,
          ...(clientImage ? { clientImage } : {}),
          ...(product === "email"
            ? {
              questionRecipient: recipient,
              question1: question1.trim(),
              question2: question2.trim() || undefined,
              question3: question3.trim() || undefined,
            }
            : {
              preparatoryNote: preparatoryNote.trim() || undefined,
            }),
        },
      };
      const raw = await api.post("/bookings", payload, token) as CreateBookingResponse;
      const bookingResponse = raw.data?.bookingId ? raw.data : raw;
      if (!bookingResponse.success || !bookingResponse.bookingId || bookingResponse.requiresPayment !== true) {
        throw new Error("Your session could not be started. Please try again.");
      }
      trackEvent("checkout_start", {
        service_type: content.sessionType,
        service_name: content.title,
        category: "offline",
        price,
        bookingId: bookingResponse.bookingId,
      });
      await startSessionCheckout(bookingResponse.bookingId, { token });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to start checkout.");
      setIsProcessing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-white sm:px-6">
      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Offline Session</p>
      <h1 className="mt-2 text-3xl font-semibold">{content.title}</h1>
      <p className="mt-3 text-sm leading-7 text-white/68">{content.intro}</p>
      <p className="mt-3 text-lg font-medium text-amber-100">{price}</p>
      <Link to={content.landingPath} className="mt-2 inline-block text-sm text-white/55 underline">
        Back to {content.title}
      </Link>

      {step === "details" ? (
        <form onSubmit={continueToReview} className="mt-8 space-y-5" noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Full Name" htmlFor="offline-name" helperText="The name to associate with this session.">
              <input id="offline-name" className={fieldClass} value={fullName} onChange={(event) => setFullName(event.target.value)} />
            </FormField>
            <FormField label="Email" htmlFor="offline-email" helperText="Confirmations and the finished MP3 are sent here.">
              <input id="offline-email" className={fieldClass} type="email" value={email} readOnly />
            </FormField>
            <FormField label="Gender" htmlFor="offline-gender" helperText="Used so a name is not interpreted more than one way.">
              <select id="offline-gender" className={`${fieldClass} bg-white text-black`} value={gender} onChange={(event) => setGender(event.target.value as Gender | "")}>
                <option value="">Select gender</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </FormField>
            <FormField label="Phone Number" htmlFor="offline-phone" helperText="Optional." optional>
              <input id="offline-phone" className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </FormField>
            <FormField label="Birthdate" htmlFor="offline-birthdate" helperText="Optional. Include it if it feels relevant." optional className="md:col-span-2">
              <input id="offline-birthdate" className={fieldClass} type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} />
            </FormField>
          </div>

          {product === "email" ? (
            <div className="space-y-4 rounded-2xl border border-cyan-200/15 bg-white/[0.03] p-4">
              <FormField label="Who would you like your questions addressed to?" htmlFor="offline-recipient">
                <select id="offline-recipient" className={`${fieldClass} bg-white text-black`} value={recipient} onChange={(event) => setRecipient(event.target.value as Recipient | "")}>
                  <option value="">Select</option>
                  {RECIPIENTS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </FormField>
              <p className="text-sm text-white/60">You may ask up to three questions. Question 1 is required. Questions 2 and 3 are optional.</p>
              <QuestionField id="question-1" label="Question 1" required value={question1} onChange={setQuestion1} />
              <QuestionField id="question-2" label="Question 2" value={question2} onChange={setQuestion2} />
              <QuestionField id="question-3" label="Question 3" value={question3} onChange={setQuestion3} />
            </div>
          ) : (
            <FormField
              label="Anything you would like Brad to know before the reading?"
              htmlFor="offline-note"
              optional
              helperText="Optional. You may share a recurring theme, relationship, location, dream, feeling, or area of life you are curious about. You do not need to identify a specific past life."
            >
              <textarea
                id="offline-note"
                className={`${fieldClass} min-h-32`}
                maxLength={NOTE_LIMIT}
                value={preparatoryNote}
                onChange={(event) => setPreparatoryNote(event.target.value)}
              />
            </FormField>
          )}

          <SessionIntakeImageField
            id="offline-intake-image"
            file={intakeImageFile}
            onChange={setIntakeImageFile}
          />

          <label className="flex items-start gap-3 text-sm text-white/75">
            <input type="checkbox" className="mt-1" checked={consentGiven} onChange={(event) => setConsentGiven(event.target.checked)} />
            <span>
              I understand this is an offline session. I do not need to book a calendar time. The completed MP3 will be emailed when it is ready.
            </span>
          </label>
          {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
          <button type="submit" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
            Review purchase
          </button>
        </form>
      ) : (
        <div className="mt-8 space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <h2 className="text-xl font-semibold">Review</h2>
          <dl className="space-y-3 text-sm">
            <ReviewRow label="Service" value={`${content.title} · ${price}`} />
            <ReviewRow label="Name" value={fullName} />
            <ReviewRow label="Email" value={email} />
            <ReviewRow label="Gender" value={gender} />
            <ReviewRow label="Phone" value={phone || "None added"} />
            <ReviewRow label="Birthdate" value={birthDate || "None added"} />
            <ReviewRow label="Photo" value={intakeImageFile?.name || "None added"} />
            {product === "email" ? (
              <>
                <ReviewRow label="Addressed to" value={recipientLabel(recipient)} />
                <ReviewRow label="Question 1" value={question1} />
                <ReviewRow label="Question 2" value={question2 || "None added"} />
                <ReviewRow label="Question 3" value={question3 || "None added"} />
              </>
            ) : (
              <ReviewRow label="Note for Brad" value={preparatoryNote || "None added"} />
            )}
          </dl>
          <p className="text-sm leading-6 text-white/65">
            Checkout continues through the existing secure Stripe payment page. After payment, your intake is saved with the order and the MP3 is emailed when the offline session is complete.
          </p>
          {error ? <p className="text-sm text-rose-200" role="alert">{error}</p> : null}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={() => setStep("details")} className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 px-5 text-sm font-semibold text-white">
              Edit intake
            </button>
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => void purchase()}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl bg-cyan-300 px-5 text-sm font-semibold text-slate-950 disabled:opacity-60"
            >
              {isProcessing ? "Starting checkout…" : `Continue to checkout — ${price}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function QuestionField({
  id,
  label,
  value,
  onChange,
  required = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <FormField label={label} htmlFor={id} optional={!required} helperText={`${value.trim().length}/${QUESTION_LIMIT}`}>
      <textarea id={id} className="min-h-28 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-3 text-sm text-white focus:border-cyan-200/50 focus:outline-none" maxLength={QUESTION_LIMIT} required={required} value={value} onChange={(event) => onChange(event.target.value)} />
    </FormField>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-[0.16em] text-white/40">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap text-white/85">{value}</dd>
    </div>
  );
}
