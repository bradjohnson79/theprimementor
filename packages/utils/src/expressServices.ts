export const EXPRESS_TRANSCRIPTION_CENTS = 900;
export const EXPRESS_CURRENCY = "CAD" as const;

export const EXPRESS_SERVICE_IDS = ["ask", "healing", "past-life"] as const;
export type ExpressServiceId = (typeof EXPRESS_SERVICE_IDS)[number];
export type ExpressGuide = "brad" | "adronis";
export type ExpressNotifyPreference = "email" | "sms" | "both";

export interface ExpressServiceDefinition {
  id: ExpressServiceId;
  productKey: string;
  name: string;
  priceCents: number;
  currency: typeof EXPRESS_CURRENCY;
  summary: string;
  detail: string;
}

export const EXPRESS_SERVICES: readonly ExpressServiceDefinition[] = [
  {
    id: "ask",
    productKey: "express-ask-brad-adronis",
    name: "Ask Brad / Adronis",
    priceCents: 1900,
    currency: EXPRESS_CURRENCY,
    summary: "One question. No appointment.",
    detail: "Choose Brad or Adronis and send one question. The reply arrives as an MP3.",
  },
  {
    id: "healing",
    productKey: "express-prime-body-healing",
    name: "Prime Body Healing Express",
    priceCents: 3900,
    currency: EXPRESS_CURRENCY,
    summary: "Up to five focus areas. No appointment.",
    detail: "Name up to five areas for a focused Prime Body Healing MP3. Add optional context if you want.",
  },
  {
    id: "past-life",
    productKey: "express-past-life-akashic",
    name: "Past Life Akashic Reading",
    priceCents: 4900,
    currency: EXPRESS_CURRENCY,
    summary: "One past life. No appointment.",
    detail: "A reading of one past life, delivered as an MP3. A particular interest is optional.",
  },
];

export function isExpressServiceId(value: string | null | undefined): value is ExpressServiceId {
  return EXPRESS_SERVICE_IDS.some((id) => id === value);
}

export function getExpressService(id: string | null | undefined): ExpressServiceDefinition | null {
  return EXPRESS_SERVICES.find((service) => service.id === id) ?? null;
}

export function formatExpressPrice(cents: number) {
  const amount = new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: EXPRESS_CURRENCY,
    maximumFractionDigits: 0,
  }).format(cents / 100);
  return `${amount} ${EXPRESS_CURRENCY}`;
}

export function expressAmountCents(serviceId: ExpressServiceId, transcription: boolean) {
  const service = getExpressService(serviceId);
  if (!service) throw new Error("Unknown Express service");
  return service.priceCents + (transcription ? EXPRESS_TRANSCRIPTION_CENTS : 0);
}

export interface ExpressCheckoutInput {
  serviceId: ExpressServiceId;
  name: string;
  email: string;
  birthdate: string;
  mobile: string;
  notify: ExpressNotifyPreference;
  smsConsent: boolean;
  transcription: boolean;
  guide: ExpressGuide | "";
  question: string;
  focusAreas: string[];
  healingContext: string;
  pastLifeInterest: string;
}

export function validateExpressCheckout(input: ExpressCheckoutInput): { ok: true; amountCents: number } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const service = getExpressService(input.serviceId);
  if (!service) errors.push("Choose an Express service.");
  if (!input.name.trim()) errors.push("Name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.push("A valid email is required.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.birthdate.trim())) errors.push("Birthdate is required.");

  const wantsSms = input.notify === "sms" || input.notify === "both";
  const mobileDigits = input.mobile.replace(/\D/g, "");
  if (wantsSms && mobileDigits.length < 10) errors.push("A mobile number is required for SMS.");
  if (wantsSms && !input.smsConsent) errors.push("SMS needs explicit consent for this order's updates.");

  if (input.serviceId === "ask") {
    if (input.guide !== "brad" && input.guide !== "adronis") errors.push("Choose Brad or Adronis.");
    if (!input.question.trim()) errors.push("Enter one question.");
  }
  if (input.serviceId === "healing") {
    const areas = input.focusAreas.map((area) => area.trim()).filter(Boolean);
    if (areas.length < 1 || areas.length > 5) errors.push("Enter one to five focus areas.");
  }

  if (errors.length > 0 || !service) return { ok: false, errors };
  return { ok: true, amountCents: expressAmountCents(service.id, input.transcription) };
}

export function expressServiceHref(serviceId: ExpressServiceId) {
  return `/?serviceType=express&service=${serviceId}#services`;
}
