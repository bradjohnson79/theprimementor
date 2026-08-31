import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyAutomatedAddress } from "./automatedFilter.js";

describe("classifyAutomatedAddress", () => {
  it("does not reject provider domains by domain alone", () => {
    assert.equal(classifyAutomatedAddress({ email: "alex.rivera@gmail.com" }).filtered, false);
    assert.equal(classifyAutomatedAddress({ email: "jordan@google.com" }).filtered, false);
    assert.equal(classifyAutomatedAddress({ email: "casey@paypal.com" }).filtered, false);
    assert.equal(classifyAutomatedAddress({ email: "morgan@stripe.com" }).filtered, false);
  });

  it("filters noreply and similar local-parts", () => {
    assert.equal(classifyAutomatedAddress({ email: "noreply@stripe.com" }).filtered, true);
    assert.equal(classifyAutomatedAddress({ email: "no-reply@paypal.com" }).filtered, true);
    assert.equal(classifyAutomatedAddress({ email: "mailer-daemon@google.com" }).filtered, true);
  });

  it("filters bulk/auto-submitted headers even for human-looking locals", () => {
    assert.equal(classifyAutomatedAddress({
      email: "updates@example.com",
      headers: { Precedence: "bulk" },
    }).filtered, true);
    assert.equal(classifyAutomatedAddress({
      email: "updates@example.com",
      headers: { "Auto-Submitted": "auto-replied" },
    }).filtered, true);
  });

  it("uses list headers only with a supporting local-part or display name", () => {
    assert.equal(classifyAutomatedAddress({
      email: "alex@gmail.com",
      headers: { "List-Unsubscribe": "<mailto:unsub@example.com>" },
    }).filtered, false);
    assert.equal(classifyAutomatedAddress({
      email: "newsletter@example.com",
      displayName: "Weekly Newsletter",
      headers: { "List-Id": "<news.example.com>" },
    }).filtered, true);
  });
});
