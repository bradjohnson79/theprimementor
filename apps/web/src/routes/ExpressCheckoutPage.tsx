import { useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  EXPRESS_TRANSCRIPTION_CENTS,
  formatExpressPrice,
  getExpressService,
  validateExpressCheckout,
  type ExpressGuide,
  type ExpressServiceId,
} from "@wisdom/utils";
import { api } from "../lib/api";

const FIELD_CLASS = "mt-1 w-full rounded-xl border border-white/15 bg-[#070b16] px-3 py-2 text-sm text-white outline-none focus:border-cyan-200/50";

export default function ExpressCheckoutPage() {
  const { serviceId } = useParams();
  const service = getExpressService(serviceId);
  if (!service) return <Navigate to="/?serviceType=express#services" replace />;
  return <ExpressCheckoutForm serviceId={service.id} />;
}

function ExpressCheckoutForm({ serviceId }: { serviceId: ExpressServiceId }) {
  const service = getExpressService(serviceId)!;
  const { isSignedIn } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [transcription, setTranscription] = useState(false);
  const [guide, setGuide] = useState<ExpressGuide | "">("");
  const [question, setQuestion] = useState("");
  const [focusAreas, setFocusAreas] = useState(["", "", "", "", ""]);
  const [healingContext, setHealingContext] = useState("");
  const [pastLifeInterest, setPastLifeInterest] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const amountCents = useMemo(
    () => service.priceCents + (transcription ? EXPRESS_TRANSCRIPTION_CENTS : 0),
    [service.priceCents, transcription],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const result = validateExpressCheckout({
      serviceId,
      name,
      email,
      birthdate,
      transcription,
      guide,
      question,
      focusAreas,
      healingContext,
      pastLifeInterest,
    });
    if (!result.ok) {
      setErrors(result.errors);
      setStatus("");
      return;
    }
    setErrors([]);
    setSubmitting(true);
    setStatus("");
    try {
      await api.post(isSignedIn ? "/express/checkout" : "/guest/express-checkout", {
        serviceId,
        name,
        email,
        birthdate,
        transcription,
        guide,
        question,
        focusAreas: focusAreas.map((area) => area.trim()).filter(Boolean),
        healingContext,
        pastLifeInterest,
        amountCents: result.amountCents,
      });
      setStatus("Checkout is ready on the isolated payments service.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      setStatus(
        message && message.length < 180 && !/networkerror|failed to fetch/i.test(message)
          ? message
          : "Express checkout is waiting for the isolated payments service. Nothing was charged.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="relative mx-auto max-w-3xl px-4 py-16 text-white sm:px-6">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-cyan-100/70">Express Services</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">{service.name}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-white/70">{service.detail}</p>
      <p className="mt-2 text-sm text-cyan-100">
        {formatExpressPrice(service.priceCents)}
        {transcription ? ` + transcription ${formatExpressPrice(EXPRESS_TRANSCRIPTION_CENTS)}` : ""}
        {" · "}
        Due today {formatExpressPrice(amountCents)}
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5 rounded-[1.5rem] border border-cyan-200/15 bg-[#070b16]/80 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-7">
        <label className="block text-sm text-white/80">Name
          <input className={FIELD_CLASS} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
        <label className="block text-sm text-white/80">Email
          <input className={FIELD_CLASS} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </label>
        <label className="block text-sm text-white/80">Birthdate
          <input className={FIELD_CLASS} type="date" value={birthdate} onChange={(event) => setBirthdate(event.target.value)} required />
        </label>

        {serviceId === "ask" ? (
          <>
            <fieldset className="space-y-2">
              <legend className="text-sm text-white/80">Who should answer?</legend>
              {(["brad", "adronis"] as const).map((value) => (
                <label key={value} className="flex items-center gap-2 text-sm text-white/75">
                  <input type="radio" name="guide" checked={guide === value} onChange={() => setGuide(value)} />
                  {value === "brad" ? "Brad" : "Adronis"}
                </label>
              ))}
            </fieldset>
            <label className="block text-sm text-white/80">Your question
              <textarea className={FIELD_CLASS} rows={4} value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>
          </>
        ) : null}

        {serviceId === "healing" ? (
          <fieldset className="space-y-2">
            <legend className="text-sm text-white/80">Focus areas (up to five)</legend>
            {focusAreas.map((area, index) => (
              <input
                key={index}
                className={FIELD_CLASS}
                value={area}
                aria-label={`Focus area ${index + 1}`}
                onChange={(event) => setFocusAreas((current) => current.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
              />
            ))}
            <label className="block text-sm text-white/80">Optional context
              <textarea className={FIELD_CLASS} rows={3} value={healingContext} onChange={(event) => setHealingContext(event.target.value)} />
            </label>
          </fieldset>
        ) : null}

        {serviceId === "past-life" ? (
          <label className="block text-sm text-white/80">Anything you want the reading to notice (optional)
            <textarea className={FIELD_CLASS} rows={3} value={pastLifeInterest} onChange={(event) => setPastLifeInterest(event.target.value)} />
          </label>
        ) : null}

        <label className="flex items-start gap-2 text-sm text-white/75">
          <input type="checkbox" checked={transcription} onChange={(event) => setTranscription(event.target.checked)} className="mt-1" />
          Add a written transcription for {formatExpressPrice(EXPRESS_TRANSCRIPTION_CENTS)}. Charged once.
        </label>

        {errors.length > 0 ? (
          <ul className="space-y-1 text-sm text-amber-100">
            {errors.map((error) => <li key={error}>{error}</li>)}
          </ul>
        ) : null}
        {status ? <p className="text-sm text-cyan-100">{status}</p> : null}

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={submitting} className="inline-flex min-h-11 items-center justify-center rounded-full bg-gradient-to-r from-cyan-300 to-violet-300 px-5 py-3 text-sm font-semibold text-[#07111f] disabled:opacity-60">
            {submitting ? "Checking…" : `Continue to payment — ${formatExpressPrice(amountCents)}`}
          </button>
          {!isSignedIn ? (
            <Link to={`/sign-in?redirect_url=${encodeURIComponent(`/express/${serviceId}`)}`} className="text-sm text-cyan-100 underline-offset-2 hover:underline">
              Sign in first
            </Link>
          ) : (
            <p className="text-sm text-white/60">This order will be attached to your account.</p>
          )}
        </div>
        <p className="text-xs leading-5 text-white/45">
          Your confirmation and your MP3 will arrive by email. Question text and birthdate are not sent to the wording model.
        </p>
      </form>
    </main>
  );
}
