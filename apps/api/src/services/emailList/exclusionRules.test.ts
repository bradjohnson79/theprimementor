import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchExclusion, parseExclusionInput } from "./exclusionRules.js";

describe("exclusionRules", () => {
  it("parses domains from @facebook.com or facebook.com", () => {
    assert.deepEqual(parseExclusionInput("@facebook.com"), {
      kind: "domain",
      value: "facebook.com",
      pattern: "@facebook.com",
    });
    assert.deepEqual(parseExclusionInput("Google.COM"), {
      kind: "domain",
      value: "google.com",
      pattern: "@google.com",
    });
  });

  it("parses a full email without stripping Gmail dots or plus tags", () => {
    const parsed = parseExclusionInput("Jane.Doe+list@Gmail.com");
    assert.equal(parsed.kind, "email");
    assert.equal(parsed.value, "jane.doe+list@gmail.com");
  });

  it("filters domain matches exactly and leaves other domains alone", () => {
    const rules = [{ kind: "domain" as const, value: "google.com" }];
    assert.equal(matchExclusion("ads@google.com", rules).filtered, true);
    assert.equal(matchExclusion("person@gmail.com", rules).filtered, false);
    assert.equal(matchExclusion("friend@mygoogle.com", rules).filtered, false);
  });

  it("filters an exact email without treating it as a domain", () => {
    const rules = [{ kind: "email" as const, value: "noreply@notify.example.com" }];
    assert.equal(matchExclusion("noreply@notify.example.com", rules).filtered, true);
    assert.equal(matchExclusion("other@notify.example.com", rules).filtered, false);
  });

  it("rejects empty or invalid patterns", () => {
    assert.throws(() => parseExclusionInput("   "), /email or a domain/i);
    assert.throws(() => parseExclusionInput("@not-a-domain"), /valid domain/i);
    assert.throws(() => parseExclusionInput("not-an-email"), /valid email or a domain/i);
  });
});
