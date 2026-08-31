import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatVisionForStrategist, pmaFromScreenshotTerms, sanitizeVisionImages } from "./pmaVision.js";

describe("PMA vision adapter", () => {
  it("rejects disallowed image types and oversized payloads", () => {
    assert.throws(() => sanitizeVisionImages([{ mimeType: "application/pdf", data: "abc" }]));
    assert.doesNotThrow(() => sanitizeVisionImages([{ mimeType: "image/png", data: Buffer.from("tiny").toString("base64") }]));
  });

  it("sends extracted screenshot terms through the existing PMA engine", () => {
    const payload = pmaFromScreenshotTerms(["buy detailed natal chart report", "free natal chart calculator"]);
    const buy = payload.candidates.find((item) => item.term.includes("buy detailed"));
    assert.equal(buy?.source, "screenshot");
    assert.equal(buy?.intent, "transactional");
  });

  it("marks screenshot text as untrusted in the strategist brief", () => {
    const brief = formatVisionForStrategist({
      model: "openai/gpt-4o-mini",
      visibleFacts: ["CTR 7.8%"],
      interpretation: "CTR looks strong",
      unknowns: ["conversions unreadable"],
      extractedTerms: ["natal report"],
      comparisonNotes: null,
      confidence: "Medium",
    });
    assert.match(brief, /untrusted/);
    assert.match(brief, /not live Google Ads API/);
    assert.match(brief, /CTR 7.8%/);
  });
});
