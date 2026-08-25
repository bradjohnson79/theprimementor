import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeShopStorageKey } from "./shopFileStorage.js";

describe("sanitizeShopStorageKey", () => {
  it("rejects path traversal and keeps a basename key", () => {
    assert.equal(sanitizeShopStorageKey("../secret.pdf"), null);
    assert.equal(sanitizeShopStorageKey("folder/file.pdf"), null);
    assert.equal(sanitizeShopStorageKey("deck-file.pdf"), "deck-file.pdf");
  });
});
