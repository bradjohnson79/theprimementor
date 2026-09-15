import assert from "node:assert/strict";
import test from "node:test";
import { getSamplePayload } from "./samplePayloads.js";
import { renderOnDemandWebinarConfirmedTemplate } from "./templates/userTemplates.js";

test("on-demand confirmation email is not the Zoom webinar template", () => {
  const payload = getSamplePayload("on_demand_webinar.confirmed");
  const rendered = renderOnDemandWebinarConfirmedTemplate(payload);

  assert.equal(rendered.subject, "Your Adronis On-Demand Webinar Is Ready");
  assert.match(rendered.html, /Watch My Webinar/);
  assert.match(rendered.html, /\$7\.99 CAD/);
  assert.match(rendered.html, /dashboard\/webinars/);
  assert.match(rendered.text ?? "", /Dashboard → Webinars/);
  assert.doesNotMatch(rendered.html, /Zoom/i);
  assert.doesNotMatch(rendered.html, /24 hours/i);
  assert.doesNotMatch(rendered.html, /playbackToken|eyJ/i);
});
