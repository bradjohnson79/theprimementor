import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decryptTokenPayload, encryptTokenPayload } from "./tokenCrypto.js";

describe("tokenCrypto", () => {
  it("round-trips a token payload", () => {
    const previous = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "a".repeat(64);
    try {
      const encrypted = encryptTokenPayload({
        accessToken: "access-secret",
        refreshToken: "refresh-secret",
        expiryDate: 123,
        scope: "https://www.googleapis.com/auth/gmail.readonly",
      });
      assert.doesNotMatch(encrypted, /access-secret|refresh-secret/);
      const decrypted = decryptTokenPayload(encrypted);
      assert.equal(decrypted.accessToken, "access-secret");
      assert.equal(decrypted.refreshToken, "refresh-secret");
    } finally {
      if (previous === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
      else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = previous;
    }
  });
});
