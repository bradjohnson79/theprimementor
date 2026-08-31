import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildGmailSearchQuery, currentSearchYear, parseSearchYear } from "./gmailSearchQuery.js";

describe("gmailSearchQuery", () => {
  it("leaves the keyword unchanged when no year is selected", () => {
    assert.equal(buildGmailSearchQuery("  Adronis  "), "Adronis");
    assert.equal(buildGmailSearchQuery("Adronis", undefined), "Adronis");
  });

  it("limits Gmail search to the selected calendar year", () => {
    assert.equal(buildGmailSearchQuery("Adronis", 2024), "Adronis after:2024/01/01 before:2025/01/01");
  });

  it("accepts a year in range and rejects an invalid year", () => {
    assert.equal(parseSearchYear(undefined), undefined);
    assert.equal(parseSearchYear(""), undefined);
    assert.equal(parseSearchYear("2024"), 2024);
    assert.equal(parseSearchYear(2024), 2024);
    assert.throws(() => parseSearchYear(1999), /Year must be between/);
    assert.throws(() => parseSearchYear(currentSearchYear() + 1), /Year must be between/);
    assert.throws(() => parseSearchYear("two-thousand"), /Year must be between/);
  });
});
