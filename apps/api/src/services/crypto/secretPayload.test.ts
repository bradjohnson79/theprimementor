import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptJson, encryptJson } from "./secretPayload.js";

describe("secretPayload", () => {
  it("round-trips JSON without exposing the plaintext", () => {
    const previous = process.env.ADS_TOKEN_ENCRYPTION_KEY;
    process.env.ADS_TOKEN_ENCRYPTION_KEY = "e".repeat(64);
    try {
      const encrypted = encryptJson({ refreshToken: "refresh-secret" }, "ADS_TOKEN_ENCRYPTION_KEY");
      assert.doesNotMatch(encrypted, /refresh-secret/);
      assert.equal(decryptJson<{ refreshToken: string }>(encrypted, "ADS_TOKEN_ENCRYPTION_KEY").refreshToken, "refresh-secret");
    } finally {
      if (previous === undefined) delete process.env.ADS_TOKEN_ENCRYPTION_KEY;
      else process.env.ADS_TOKEN_ENCRYPTION_KEY = previous;
    }
  });
});
