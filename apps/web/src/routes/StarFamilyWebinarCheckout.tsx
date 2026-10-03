import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/react";
import {
  STAR_FAMILY_WEBINAR_EVENT_ID,
  STAR_FAMILY_WEBINAR_FEATURE_BULLETS,
  STAR_FAMILY_WEBINAR_LANDSCAPE_POSTER_PATH,
  STAR_FAMILY_WEBINAR_THANK_YOU_PATH,
  getStarFamilyWebinarPublicCatalog,
} from "@wisdom/utils";
import StarFamilyCheckoutButton from "../components/webinars/StarFamilyCheckoutButton";
import StarFamilyPoster from "../components/webinars/StarFamilyPoster";
import { usePageMeta } from "../hooks/usePageMeta";
import { trackEvent, trackEventOnce } from "../lib/analytics";
import { fetchWebinarMe } from "../lib/webinarApi";
import { startWebinarCheckout } from "../lib/webinarCheckout";

const CANONICAL = "https://theprimementor.com/webinars/adronis-star-family-communion";
const CTA_CLASS = "inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-[#D7B454] to-[#F2D88A] px-6 py-3 text-sm font-semibold text-[#07111C] shadow-[0_10px_32px_rgba(215,180,84,0.22)] transition hover:-translate-y-px hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

const FAQS = [
  ["When is the webinar?", "Saturday, October 17, 2026 at 10:00 AM Pacific / 1:00 PM Eastern."],
  ["Where will the webinar be held?", "Live through Zoom. Paid attendees receive the Zoom registration link after purchase."],
  ["How much does registration cost?", "$14.99 CAD."],
  ["Do I need a Prime Mentor account?", "Yes. A free account is required to complete the purchase and access the complimentary recording."],
  ["What is included?", "Live attendance, the guided theta-state contact meditation, live interaction with Adronis, entry into both giveaways, and access to the complete recording."],
  ["Is the recording included?", "Yes. Every paid registration includes the full webinar recording at no additional cost."],
  ["Where will I access the recording?", "Log in to The Prime Mentor and open Dashboard → Webinars after the recording has been published."],
  ["Do I need meditation experience?", "No. Attendees should be able to follow the guided experience regardless of prior meditation experience."],
  ["Does the webinar guarantee contact or a physical sighting?", "No. Individual experiences vary. The webinar provides a guided spiritual and meditative process and does not guarantee a particular contact experience or result."],
  ["How are the giveaway recipients selected?", "Recipients will be selected during the live webinar. Registration does not guarantee winning a private session."],
  ["What if I do not receive the email?", "The verified purchase and webinar access should still appear in the member dashboard. For help, visit https://theprimementor.com/#contact."],
] as const;

export default function StarFamilyWebinarCheckout() {
  const { isSignedIn, getToken } = useAuth();
  const catalog = getStarFamilyWebinarPublicCatalog();
  const [owned, setOwned] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autocheckoutStartedRef = useRef(false);
  const params = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search);
  const shouldAutocheckout = params.get("autocheckout") === "1";

  usePageMeta({
    title: "Adronis: Star Family Communion | Live Webinar",
    description: "Join Brad Johnson and Adronis live on October 17 for a guided theta-state journey into star-family communion, intuitive contact and spiritual connection. Includes two live giveaways and the complete webinar recording.",
    canonical: CANONICAL,
    ogImage: `https://theprimementor.com${STAR_FAMILY_WEBINAR_LANDSCAPE_POSTER_PATH}`,
    ogType: "website",
    jsonLd: [{
      "@context": "https://schema.org",
      "@type": "Event",
      name: catalog.title,
      description: catalog.description,
      startDate: catalog.startsAt,
      eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
      eventStatus: catalog.registrationOpen
        ? "https://schema.org/EventScheduled"
        : "https://schema.org/EventScheduled",
      location: {
        "@type": "VirtualLocation",
        url: CANONICAL,
      },
      image: [`https://theprimementor.com${STAR_FAMILY_WEBINAR_LANDSCAPE_POSTER_PATH}`],
      organizer: {
        "@type": "Organization",
        name: "The Prime Mentor",
        url: "https://theprimementor.com",
      },
      offers: {
        "@type": "Offer",
        price: "14.99",
        priceCurrency: "CAD",
        url: CANONICAL,
        availability: catalog.registrationOpen
          ? "https://schema.org/InStock"
          : "https://schema.org/SoldOut",
      },
    }],
  });

  useEffect(() => {
    trackEventOnce("analytics:star-family:landing-view", "webinar_view", {
      webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
      webinar_type: "live_webinar",
      placement: "landing_page",
      price_cents: catalog.priceCents,
      currency: catalog.currency,
    });
  }, [catalog.currency, catalog.priceCents]);

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        const state = await fetchWebinarMe(STAR_FAMILY_WEBINAR_EVENT_ID, token);
        if (!cancelled) setOwned(Boolean(state.joinEligible));
      } catch {
        if (!cancelled) setOwned(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isSignedIn]);

  useEffect(() => {
    if (!isSignedIn || !shouldAutocheckout || autocheckoutStartedRef.current || owned || !catalog.registrationOpen) {
      return;
    }
    autocheckoutStartedRef.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("autocheckout");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    void (async () => {
      try {
        const token = await getToken();
        trackEvent("webinar_checkout_started", {
          webinar_id: STAR_FAMILY_WEBINAR_EVENT_ID,
          webinar_type: "live_webinar",
          placement: "landing_page",
          price_cents: 1499,
          currency: "CAD",
        });
        await startWebinarCheckout(STAR_FAMILY_WEBINAR_EVENT_ID, { token });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to open Stripe checkout.";
        setError(message);
      }
    })();
  }, [catalog.registrationOpen, getToken, isSignedIn, owned, shouldAutocheckout]);

  return (
    <div className="relative isolate overflow-hidden text-[#F8FAFC]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(24,80,120,0.34),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(43,125,142,0.22),transparent_32%),radial-gradient(circle_at_50%_70%,rgba(80,40,130,0.18),transparent_42%)]" aria-hidden />
      <article className="relative mx-auto max-w-6xl space-y-12 px-4 py-12 sm:px-6 sm:py-16">
        <header className="space-y-5">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/80">Live Adronis Webinar</p>
          <h1 className="max-w-4xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">{catalog.title}</h1>
          <p className="max-w-3xl text-xl text-amber-100/90">Enter the Theta State. Open the Inner Channels. Connect with Your Star Family.</p>
          <p className="max-w-3xl text-base leading-8 text-white/75">{catalog.description}</p>
          <ul className="space-y-1 text-sm text-white/80">
            <li>{catalog.displayDate}</li>
            <li>{catalog.displayTime}</li>
            <li>Live on Zoom</li>
            <li>{catalog.displayPrice}</li>
            <li>Complimentary recording included</li>
          </ul>
          <div className="space-y-3">
            {owned ? (
              <Link to={STAR_FAMILY_WEBINAR_THANK_YOU_PATH} className={CTA_CLASS}>View Your Registration</Link>
            ) : catalog.registrationOpen ? (
              <StarFamilyCheckoutButton source="star_family_landing" placement="landing_page" className={CTA_CLASS} onError={setError} />
            ) : (
              <p className="text-sm text-white/70">Live registration for this webinar has closed.</p>
            )}
            <p className="text-sm text-white/55">A free Prime Mentor account is required to purchase and access your webinar recording.</p>
            {error ? <p className="text-sm text-amber-200">{error}</p> : null}
          </div>
        </header>

        <figure className="overflow-hidden rounded-3xl border border-white/10 bg-[#04050f]">
          <StarFamilyPoster priority />
        </figure>

        <section className="space-y-4 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">A Guided Journey into Star Family Communion</h2>
          <p className="leading-8 text-white/75">Adronis will guide attendees into a deeply relaxed theta brainwave state while helping them open and align the chakra centers and psychic channels throughout the body. From this receptive state of consciousness, participants will be guided toward direct inner communication with their star-family liaison.</p>
          <p className="leading-8 text-white/75">This meditative process may also support intuitive connection with spirit guides, angelic beings and loved ones in Spirit. Attendees will learn how to recognize subtle impressions, communicate inwardly and check for permission before requesting a physical contact experience or sighting.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">What Attendees Will Experience</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {STAR_FAMILY_WEBINAR_FEATURE_BULLETS.map((item) => (
              <li key={item} className="rounded-2xl border border-white/10 bg-[#07111f]/70 px-4 py-3 text-sm leading-6 text-white/75">{item}</li>
            ))}
          </ul>
        </section>

        <section className="space-y-4 rounded-[2rem] border border-cyan-200/15 bg-[#07111f]/80 p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">Enter the Theta State</h2>
          <p className="leading-8 text-white/75">Theta is a deeply receptive state of consciousness associated with meditation, inner imagery, intuition and expanded awareness. Adronis will guide attendees into this quieter state while supporting the opening and alignment of the body’s energetic centers.</p>
          <p className="leading-8 text-white/75">From this inner stillness, attendees will be invited to establish a clearer connection with their star family and other benevolent spiritual presences.</p>
          <p className="text-sm text-white/55">Individual experiences vary. This guided meditation is a spiritual practice and is not medical treatment.</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-semibold text-white">Contact with Permission and Discernment</h2>
          <ul className="space-y-2 text-sm leading-7 text-white/75">
            {[
              "Establishing inner communication first",
              "Recognizing the presence of a star-family liaison",
              "Asking inwardly whether contact is appropriate",
              "Checking whether permission is present for a physical sighting or experience",
              "Respecting personal comfort, readiness and boundaries",
              "Remaining grounded instead of forcing an experience",
            ].map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section className="grid gap-4 rounded-[2rem] border border-amber-200/20 bg-[#07111f]/80 p-6 sm:grid-cols-2 sm:p-8">
          <div className="sm:col-span-2 space-y-3">
            <h2 className="text-2xl font-semibold text-white">Two Live Session Giveaways</h2>
            <p className="text-white/75">Two attendees will be selected during the live webinar.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-amber-100">60-Minute Q&A Session</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">A private 60-minute question-and-answer session with Brad Johnson and Adronis.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <h3 className="text-lg font-semibold text-amber-100">30-Minute Q&A Session</h3>
            <p className="mt-2 text-sm leading-6 text-white/70">A private 30-minute question-and-answer session with Brad Johnson and Adronis.</p>
          </div>
          <p className="sm:col-span-2 text-sm text-white/55">Giveaway recipients will be selected during the live webinar. Registration does not guarantee winning a private session.</p>
        </section>

        <section className="space-y-3 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">Your Registration Includes the Complete Recording</h2>
          <p className="leading-8 text-white/75">Every paid registration includes complimentary access to the complete recording of Adronis: Star Family Communion. Attend live on Zoom and return to the experience whenever you feel called to revisit the meditation and teachings.</p>
        </section>

        <section className="space-y-4 rounded-[2rem] border border-cyan-200/20 bg-[#07111f] p-6 sm:p-8">
          <h2 className="text-2xl font-semibold text-white">Register for the Live Webinar</h2>
          <p className="text-white/75">{catalog.displayDate} · {catalog.displayTime} · {catalog.displayPrice}</p>
          {catalog.registrationOpen && !owned ? (
            <StarFamilyCheckoutButton source="star_family_landing_bottom" placement="landing_page" className={CTA_CLASS} onError={setError} />
          ) : owned ? (
            <Link to={STAR_FAMILY_WEBINAR_THANK_YOU_PATH} className={CTA_CLASS}>View Your Registration</Link>
          ) : (
            <p className="text-sm text-white/70">Live registration for this webinar has closed.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold text-white">Frequently Asked Questions</h2>
          <div className="space-y-2">
            {FAQS.map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">{question}</summary>
                <p className="mt-2 text-sm leading-6 text-white/70">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </article>
    </div>
  );
}
