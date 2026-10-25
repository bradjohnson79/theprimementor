/**
 * Schema.org JSON-LD builders (AI/SEO round, Oct 25 2026).
 *
 * Facts only from the codebase or Brad's own answers:
 * - sameAs: the four verified profile URLs in socialLinks.ts.
 * - areaServed: Brad, Oct 25 2026 - sessions mostly by phone or Zoom, worldwide;
 *   in person around Langley, Surrey and greater Vancouver, BC, Canada.
 *   No street address on purpose.
 * - Prices: always read from @wisdom/utils (CANONICAL_SESSION_OFFERINGS,
 *   MEMBER_PRICING, report pricing, webinar catalogs). Never type a price here.
 */
import {
  CANONICAL_SESSION_OFFERINGS,
  MEMBER_PRICING,
  type SessionOfferingSessionType,
} from "@wisdom/utils";
import { FACEBOOK_URL, INSTAGRAM_URL, THREADS_URL, YOUTUBE_URL } from "./socialLinks";
import { SITE_NAME, SITE_ORIGIN, pageCanonical } from "./siteMeta";

export const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
export const PERSON_ID = `${SITE_ORIGIN}/#brad-johnson`;
export const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export const SAME_AS = [YOUTUBE_URL, FACEBOOK_URL, INSTAGRAM_URL, THREADS_URL];

export const AREA_SERVED = [
  "Worldwide (online sessions by phone or Zoom)",
  { "@type": "City", name: "Langley", containedInPlace: { "@type": "AdministrativeArea", name: "British Columbia, Canada" } },
  { "@type": "City", name: "Surrey", containedInPlace: { "@type": "AdministrativeArea", name: "British Columbia, Canada" } },
  { "@type": "AdministrativeArea", name: "Greater Vancouver, British Columbia, Canada" },
];

const PROVIDER_REF = { "@id": ORGANIZATION_ID };

export function personLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": PERSON_ID,
    name: "Brad Johnson",
    jobTitle: "Metaphysical Teacher and Mentor",
    description:
      "Brad Johnson is a metaphysical teacher and mentor and the founder of The Prime Mentor. He has spent more than 18 years helping people understand themselves more deeply through private sessions, Divin8 reports, and teachings.",
    url: pageCanonical("/about"),
    image: pageCanonical("/about/bradjohnson.png"),
    worksFor: { "@id": ORGANIZATION_ID },
    sameAs: SAME_AS,
  };
}

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    "@id": ORGANIZATION_ID,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    image: `${SITE_ORIGIN}/images/divin8-reports-og.webp`,
    description:
      "The Prime Mentor is Brad Johnson's metaphysical mentoring practice: private Q&A and mentoring sessions by phone or Zoom, offline sessions delivered as an emailed MP3 recording, written Divin8 astrology and numerology reports, memberships, and webinars.",
    founder: { "@id": PERSON_ID },
    areaServed: AREA_SERVED,
    currenciesAccepted: "CAD",
    sameAs: SAME_AS,
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    publisher: { "@id": ORGANIZATION_ID },
  };
}

function priceString(cents: number) {
  return (cents / 100).toFixed(2);
}

function offeringName(offering: { displayName: string; durationMinutes: number | null }) {
  return offering.durationMinutes ? `${offering.displayName} (${offering.durationMinutes} minutes)` : offering.displayName;
}

/** Service entry whose offers come straight from CANONICAL_SESSION_OFFERINGS. */
export function sessionServiceLd(input: {
  name: string;
  path: string;
  description: string;
  productKeys?: readonly string[];
  sessionType?: SessionOfferingSessionType;
  serviceType?: string;
}) {
  const offerings = CANONICAL_SESSION_OFFERINGS.filter((offering) => {
    if (!offering.active) return false;
    if (input.productKeys) return input.productKeys.includes(offering.productKey);
    return offering.sessionType === input.sessionType;
  });
  const url = pageCanonical(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: input.name,
    serviceType: input.serviceType ?? input.name,
    description: input.description,
    url,
    provider: PROVIDER_REF,
    areaServed: AREA_SERVED,
    offers: offerings.map((offering) => ({
      "@type": "Offer",
      name: offeringName(offering),
      price: priceString(offering.amountCents),
      priceCurrency: offering.currency,
      url,
      availability: "https://schema.org/InStock",
      ...(offering.billingType === "subscription"
        ? { priceSpecification: { "@type": "UnitPriceSpecification", price: priceString(offering.amountCents), priceCurrency: offering.currency, billingDuration: "P1M", unitText: "month" } }
        : {}),
    })),
  };
}

export function membershipServiceLd(path: string) {
  const url = pageCanonical(path);
  const allTiers = [
    ["seeker", "Seeker"],
    ["initiate", "Initiate"],
  ] as const;
  // /subscriptions/seeker and /subscriptions/initiate describe one tier each.
  const tiers = allTiers.filter(([tier]) => !path.startsWith("/subscriptions/") || path.startsWith(`/subscriptions/${tier}`));
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "The Prime Mentor Membership",
    serviceType: "Membership",
    description:
      "Seeker and Initiate memberships for ongoing Divin8 guidance, member savings, and course support.",
    url,
    provider: PROVIDER_REF,
    offers: tiers.flatMap(([tier, label]) =>
      (["monthly", "annual"] as const).map((interval) => ({
        "@type": "Offer",
        name: `${label} membership (${interval})`,
        price: MEMBER_PRICING[tier][interval].amountCad.toFixed(2),
        priceCurrency: "CAD",
        url,
        priceSpecification: {
          "@type": "UnitPriceSpecification",
          price: MEMBER_PRICING[tier][interval].amountCad.toFixed(2),
          priceCurrency: "CAD",
          billingDuration: interval === "monthly" ? "P1M" : "P1Y",
          unitText: interval === "monthly" ? "month" : "year",
        },
      })),
    ),
  };
}

export function faqPageLd(items: readonly { question: string; answer: string }[], path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: pageCanonical(path),
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/** Online event (live webinar) built from a webinar catalog entry. */
export function onlineEventLd(input: {
  name: string;
  description: string;
  path: string;
  startsAt: string;
  durationMinutes: number;
  priceCents: number;
  currency: string;
  image: string;
  isOpen: boolean;
}) {
  const start = new Date(input.startsAt);
  const end = new Date(start.getTime() + input.durationMinutes * 60_000);
  const url = pageCanonical(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: input.name,
    description: input.description,
    url,
    image: pageCanonical(input.image),
    startDate: input.startsAt,
    endDate: end.toISOString(),
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    eventStatus: "https://schema.org/EventScheduled",
    location: { "@type": "VirtualLocation", url },
    organizer: PROVIDER_REF,
    performer: { "@id": PERSON_ID },
    offers: {
      "@type": "Offer",
      price: priceString(input.priceCents),
      priceCurrency: input.currency,
      url,
      availability: input.isOpen ? "https://schema.org/InStock" : "https://schema.org/SoldOut",
    },
  };
}

/** Recorded webinar sold on demand. */
export function onDemandVideoProductLd(input: {
  name: string;
  description: string;
  path: string;
  image: string;
  priceCents: number;
  currency: string;
}) {
  const url = pageCanonical(input.path);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${input.name} (on-demand recording)`,
    description: input.description,
    url,
    image: pageCanonical(input.image),
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      price: priceString(input.priceCents),
      priceCurrency: input.currency,
      url,
      availability: "https://schema.org/InStock",
      seller: PROVIDER_REF,
    },
  };
}
