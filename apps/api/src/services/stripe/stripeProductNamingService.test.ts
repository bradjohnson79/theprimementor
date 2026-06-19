import assert from "node:assert/strict";
import test from "node:test";
import { resolveStripeProductNaming } from "./stripeProductNamingService.js";

test("resolveStripeProductNaming names session products by duration and type", () => {
  assert.equal(resolveStripeProductNaming({ type: "session", sessionType: "qa_session", durationMinutes: 30 }).productName, "30 Minute Q&A Session");
  assert.equal(resolveStripeProductNaming({ type: "session", sessionType: "qa_session", durationMinutes: 45 }).productName, "45 Minute Q&A Session");
  assert.equal(resolveStripeProductNaming({ type: "session", sessionType: "qa_session", durationMinutes: 60 }).productName, "60 Minute Q&A Session");
  assert.equal(resolveStripeProductNaming({ type: "session", sessionType: "focus", durationMinutes: 45 }).productName, "45 Minute Focus Session");
  assert.equal(resolveStripeProductNaming({ type: "session", sessionType: "mentoring", durationMinutes: 90 }).productName, "90 Minute Mentoring Session");
});

test("resolveStripeProductNaming uses canonical Divin8 report names", () => {
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "intro" }).productName, "Introductory Divin8 Report");
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "deep_dive" }).productName, "Deep Dive Divin8 Report");
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "initiate" }).productName, "Initiate Divin8 Report");
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "three_questions" }).productName, "3 Questions Divin8 Report");
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "compatibility" }).productName, "Partner Compatibility Report");
  assert.equal(resolveStripeProductNaming({ type: "report", reportType: "annual_12_month" }).productName, "12 Month Annual Report");
});

test("resolveStripeProductNaming names events, subscriptions, and add-ons", () => {
  assert.equal(resolveStripeProductNaming({ type: "event", eventType: "mentoring_circle" }).productName, "Mentoring Circle Registration");
  assert.equal(resolveStripeProductNaming({ type: "event", eventType: "webinar" }).productName, "Prime Mentor Webinar Registration");
  assert.equal(resolveStripeProductNaming({ type: "subscription", subscriptionType: "membership", tier: "seeker" }).productName, "Premium Member Subscription");
  assert.equal(resolveStripeProductNaming({ type: "subscription", subscriptionType: "regeneration" }).productName, "Regeneration Monthly Package");
  assert.equal(resolveStripeProductNaming({ type: "addon", addonType: "regeneration_manifestation_enhancement" }).productName, "Optional Additional Manifestation Request for First Month");
});

test("resolveStripeProductNaming emits consistent global metadata", () => {
  const naming = resolveStripeProductNaming({ type: "session", sessionType: "mentoring", durationMinutes: 90 });
  assert.equal(naming.metadata.platform, "prime_mentor");
  assert.equal(naming.metadata.product_type, "session");
  assert.equal(naming.metadata.session_type, "mentoring");
  assert.equal(naming.metadata.duration, "90");
  assert.equal(naming.metadata.product_name, "90 Minute Mentoring Session");
});
