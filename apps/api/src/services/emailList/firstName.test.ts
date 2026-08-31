import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractFirstName } from "./firstName.js";

describe("extractFirstName", () => {
  it("uses the first display-name token", () => {
    assert.equal(extractFirstName("Jane Q. Public", "ignored@example.com"), "Jane");
  });

  it("falls back to a simple local-part", () => {
    assert.equal(extractFirstName(null, "sarah@example.com"), "Sarah");
  });

  it("does not invent a name from generic local-parts", () => {
    assert.equal(extractFirstName("", "info@example.com"), null);
    assert.equal(extractFirstName(null, "support@example.com"), null);
  });
});
