import { getStarFamilyWebinarPublicCatalog, isStarFamilyWebinarHomeVisible } from "@wisdom/utils";
import assert from "node:assert/strict";
import test from "node:test";
import {
  ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY,
  ADRONIS_WEBINAR_PRICE_ENV_KEY,
  assertWebinarRegistrationOpen,
  resolveWebinarStripePriceId,
} from "./webinarBilling.js";
import {
  ADRONIS_WEBINAR_EVENT,
  ADRONIS_WEBINAR_STRIPE_PRICE_ID,
  STAR_FAMILY_WEBINAR_EVENT,
  STAR_FAMILY_WEBINAR_STRIPE_PRICE_ID,
  resolveWebinarZoomRegistrationUrl,
} from "./webinarEvents.js";

const ORIGINAL_ENV = { ...process.env };

test.afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

test("webinar checkout uses the server-owned Stripe Price ID", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env[ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY];
  delete process.env[ADRONIS_WEBINAR_PRICE_ENV_KEY];

  assert.deepEqual(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT), {
    priceId: ADRONIS_WEBINAR_STRIPE_PRICE_ID,
    envKey: ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY,
    event: ADRONIS_WEBINAR_EVENT,
    source: "event",
  });
});

test("webinar live price prefers the environment override", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  process.env[ADRONIS_WEBINAR_LIVE_PRICE_ENV_KEY] = "price_live_override";

  assert.equal(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT).priceId, "price_live_override");
  assert.equal(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT).source, "env");
});

test("webinar test mode uses the non-live environment key when present", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env[ADRONIS_WEBINAR_PRICE_ENV_KEY] = "price_test_configured";

  assert.deepEqual(resolveWebinarStripePriceId(ADRONIS_WEBINAR_EVENT), {
    priceId: "price_test_configured",
    envKey: ADRONIS_WEBINAR_PRICE_ENV_KEY,
    event: ADRONIS_WEBINAR_EVENT,
    source: "env",
  });
});

test("webinar registration is rejected after the owner cutoff", () => {
  assert.throws(
    () => assertWebinarRegistrationOpen(ADRONIS_WEBINAR_EVENT, new Date("2026-09-12T09:00:00-07:00")),
    /Registration for this webinar has closed/i,
  );
});

test("webinar registration remains open before the owner cutoff", () => {
  assert.doesNotThrow(() => {
    assertWebinarRegistrationOpen(ADRONIS_WEBINAR_EVENT, new Date("2026-09-12T08:59:59-07:00"));
  });
});

test("star family test mode never falls back to the live price", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  delete process.env.STRIPE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION;
  process.env.STRIPE_LIVE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION = STAR_FAMILY_WEBINAR_STRIPE_PRICE_ID;
  assert.throws(
    () => resolveWebinarStripePriceId(STAR_FAMILY_WEBINAR_EVENT),
    /Live price IDs are never used in test mode/i,
  );
});

test("star family checkout uses its own test price and not the disclosure price", () => {
  process.env.STRIPE_SECRET_KEY = "sk_test_example";
  process.env.STRIPE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION = "price_star_family_test";
  process.env.STRIPE_PRICE_ADRONIS_WEBINAR = "price_disclosure_test";
  const resolved = resolveWebinarStripePriceId(STAR_FAMILY_WEBINAR_EVENT);
  assert.equal(resolved.priceId, "price_star_family_test");
  assert.notEqual(resolved.priceId, ADRONIS_WEBINAR_STRIPE_PRICE_ID);
  assert.notEqual(resolved.priceId, "price_disclosure_test");
  assert.equal(resolved.event.priceCents, 1499);
  assert.equal(resolved.event.currency, "CAD");
});

test("star family live mode uses the supplied live price", () => {
  process.env.STRIPE_SECRET_KEY = "sk_live_example";
  delete process.env.STRIPE_LIVE_PRICE_ADRONIS_STAR_FAMILY_COMMUNION;
  assert.equal(resolveWebinarStripePriceId(STAR_FAMILY_WEBINAR_EVENT).priceId, STAR_FAMILY_WEBINAR_STRIPE_PRICE_ID);
});

test("star family registration closes one hour before the Pacific start", () => {
  assert.doesNotThrow(() => assertWebinarRegistrationOpen(STAR_FAMILY_WEBINAR_EVENT, new Date("2026-10-17T08:59:59-07:00")));
  assert.throws(
    () => assertWebinarRegistrationOpen(STAR_FAMILY_WEBINAR_EVENT, new Date("2026-10-17T09:00:00-07:00")),
    /closed/i,
  );
});

test("star family homepage section leaves at 9:30am Pacific on October 17", () => {
  assert.equal(isStarFamilyWebinarHomeVisible(new Date("2026-10-17T09:29:59-07:00")), true);
  assert.equal(isStarFamilyWebinarHomeVisible(new Date("2026-10-17T09:30:00-07:00")), false);
});

test("star family public catalog omits the zoom registration url", () => {
  const catalog = getStarFamilyWebinarPublicCatalog(new Date("2026-10-03T12:00:00-07:00"));
  const serialized = JSON.stringify(catalog);
  assert.equal(catalog.registrationOpen, true);
  assert.equal(catalog.startsAt, "2026-10-17T10:00:00-07:00");
  assert.doesNotMatch(serialized, /zoom\.us|eTHsHKnRQ16W0yoB5HaR6Q|price_1UMYJi/i);
});

test("star family zoom url stays on the server resolver and can be overridden", () => {
  delete process.env.ZOOM_REGISTRATION_URL_ADRONIS_STAR_FAMILY_COMMUNION;
  assert.match(resolveWebinarZoomRegistrationUrl(STAR_FAMILY_WEBINAR_EVENT), /eTHsHKnRQ16W0yoB5HaR6Q/);
  process.env.ZOOM_REGISTRATION_URL_ADRONIS_STAR_FAMILY_COMMUNION = "https://zoom.example/register/override";
  assert.equal(resolveWebinarZoomRegistrationUrl(STAR_FAMILY_WEBINAR_EVENT), "https://zoom.example/register/override");
  assert.equal(resolveWebinarZoomRegistrationUrl(ADRONIS_WEBINAR_EVENT), ADRONIS_WEBINAR_EVENT.zoomRegistrationUrl);
});
