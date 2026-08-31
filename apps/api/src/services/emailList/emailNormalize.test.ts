import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emailsMatch, isValidEmail, normalizeEmail } from "./emailNormalize.js";

describe("emailNormalize", () => {
  it("trims and lowercases the full address", () => {
    assert.equal(normalizeEmail("  Brad.Johnson+tag@Example.COM  "), "brad.johnson+tag@example.com");
  });

  it("does not strip Gmail dots or plus tags", () => {
    assert.equal(normalizeEmail("first.last+promo@gmail.com"), "first.last+promo@gmail.com");
    assert.notEqual(normalizeEmail("firstlast@gmail.com"), normalizeEmail("first.last@gmail.com"));
  });

  it("matches emails after normalization", () => {
    assert.equal(emailsMatch("a@Example.com", "a@example.com"), true);
    assert.equal(emailsMatch("a.b@gmail.com", "ab@gmail.com"), false);
  });

  it("rejects invalid addresses", () => {
    assert.equal(isValidEmail("not-an-email"), false);
    assert.equal(isValidEmail("user@.com"), false);
    assert.equal(isValidEmail(".user@example.com"), false);
    assert.equal(isValidEmail("good.user@example.com"), true);
  });
});
