import assert from "node:assert/strict";
import test from "node:test";
import { getSamplePayload } from "./samplePayloads.js";
import { renderStarFamilyWebinarConfirmedTemplate, renderWebinarConfirmedTemplate } from "./templates/userTemplates.js";

test("star family confirmation email is separate from the disclosure template", () => {
  const payload = getSamplePayload("star_family_webinar.confirmed");
  const rendered = renderStarFamilyWebinarConfirmedTemplate(payload);
  const disclosure = renderWebinarConfirmedTemplate(getSamplePayload("webinar.confirmed"));

  assert.equal(rendered.subject, "You’re Registered — Adronis: Star Family Communion");
  assert.match(rendered.html, /Register on Zoom/);
  assert.match(rendered.html, /eTHsHKnRQ16W0yoB5HaR6Q/);
  assert.match(rendered.html, /\$14\.99 CAD/);
  assert.match(rendered.html, /Saturday, October 17, 2026/);
  assert.match(rendered.html, /complete recording/i);
  assert.match(rendered.html, /theprimementor.com\/#contact/);
  assert.match(rendered.html, /dashboard\/webinars/);
  assert.doesNotMatch(rendered.subject, /From Disclosure to Contact/);
  assert.notEqual(rendered.subject, disclosure.subject);
  assert.equal(payload.bookingId, "booking_star_family_confirmed");
});
