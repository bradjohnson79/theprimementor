import { Link } from "react-router-dom";
import { usePageMeta } from "../hooks/usePageMeta";
import {
  EMAIL_SESSION_BOOKING_PATH,
  EMAIL_SESSION_LANDING_PATH,
  PAST_LIFE_AKASHIC_BOOKING_PATH,
  PAST_LIFE_AKASHIC_LANDING_PATH,
} from "../lib/sessionLandingPaths";
import { getActiveSessionOfferingByBookingTypeId } from "@wisdom/utils";

type OfflineProduct = "email" | "pastLife";

const PRODUCTS = {
  email: {
    bookingTypeId: "email-session",
    title: "Email Session",
    path: EMAIL_SESSION_LANDING_PATH,
    bookingPath: EMAIL_SESSION_BOOKING_PATH,
    image: "/images/email-session.png",
    cta: "Start Email Session",
    description:
      "Ask up to three questions on any topic for Brad or Adronis. Brad will complete your session offline and send you a private MP3 recording by email once your session is complete.",
    facts: [
      "Up to 3 questions",
      "Questions may be directed to Brad, Adronis, or both",
      "You do not attend a live appointment",
      "Brad records the answers privately",
      "The completed session is delivered as an MP3 by email",
      "No Zoom appointment or scheduling selection",
    ],
  },
  pastLife: {
    bookingTypeId: "past-life-akashic-reading",
    title: "Past Life Akashic Reading",
    path: PAST_LIFE_AKASHIC_LANDING_PATH,
    bookingPath: PAST_LIFE_AKASHIC_BOOKING_PATH,
    image: "/images/past-life-akashic-reading.png",
    cta: "Request Reading",
    description:
      "Request an exploration of one past life within your Akashic Records. Brad Johnson will privately conduct and interpret the reading and send the completed session to you as an MP3 recording by email.",
    facts: [
      "This is an offline reading",
      "It explores one past life",
      "Brad conducts and interprets the reading",
      "There is no live Zoom appointment",
      "The completed reading is delivered by MP3 through email",
    ],
  },
} as const;

function priceLabel(bookingTypeId: string) {
  const offering = getActiveSessionOfferingByBookingTypeId(bookingTypeId);
  if (!offering) return "";
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: offering.currency,
    maximumFractionDigits: 0,
  }).format(offering.amountCents / 100) + ` ${offering.currency}`;
}

export default function OfflineSessionPage({ product }: { product: OfflineProduct }) {
  const content = PRODUCTS[product];
  const price = priceLabel(content.bookingTypeId);
  usePageMeta({
    title: `${content.title} | The Prime Mentor`,
    description: content.description,
    canonical: content.path,
    ogImage: content.image,
  });

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-12 text-white sm:px-6 sm:py-16">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-cyan-100/70">Offline Session</p>
      <div className="mt-4 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]">
        <div className="space-y-5">
          <h1 className="text-4xl font-semibold tracking-[-0.04em]">{content.title}</h1>
          <p className="text-lg font-medium text-amber-100">{price}</p>
          <p className="max-w-2xl text-base leading-7 text-white/72">{content.description}</p>
          <ul className="space-y-2 text-sm text-white/75">
            {content.facts.map((fact) => (
              <li key={fact} className="flex gap-2">
                <span className="text-cyan-200" aria-hidden="true">✓</span>
                <span>{fact}</span>
              </li>
            ))}
          </ul>
          <Link
            to={content.bookingPath}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-cyan-300 px-6 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200"
          >
            {content.cta}
          </Link>
          <p className="text-xs text-white/50">Create a Free Account or Sign-in to Purchase</p>
        </div>
        <img
          src={content.image}
          alt=""
          className="w-full rounded-3xl border border-cyan-200/15 object-cover shadow-[0_24px_80px_rgba(0,0,0,0.35)]"
        />
      </div>
    </div>
  );
}
