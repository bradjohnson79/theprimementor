import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildShopContentDisposition,
  createShopDownloadToken,
  isPublicShopBooklet,
  verifyShopDownloadToken,
} from "./shopDownloadService.js";

describe("shopDownloadService tokens", () => {
  it("accepts a fresh token and rejects an expired one", () => {
    const fresh = createShopDownloadToken({
      fileId: "file-1",
      userId: "user-1",
      expiresAt: Date.now() + 60_000,
    });
    const parsed = verifyShopDownloadToken(fresh);
    assert.equal(parsed.fileId, "file-1");
    assert.equal(parsed.userId, "user-1");

    const expired = createShopDownloadToken({
      fileId: "file-1",
      userId: "user-1",
      expiresAt: Date.now() - 1,
    });
    assert.throws(() => verifyShopDownloadToken(expired), /expired/i);
  });

  it("rejects a tampered token", () => {
    const token = createShopDownloadToken({
      fileId: "file-1",
      userId: "user-1",
      expiresAt: Date.now() + 60_000,
    });
    assert.throws(() => verifyShopDownloadToken(`${token}x`), /invalid/i);
  });
});

describe("shop download Content-Disposition", () => {
  it("keeps unicode display names ASCII-safe so Node will not crash on the header", () => {
    const header = buildShopContentDisposition("Source Deck — Body Set User's Manual", ".pdf");
    assert.match(header, /filename="Source Deck - Body Set User's Manual\.pdf"/);
    assert.match(header, /filename\*=UTF-8''Source%20Deck/);
    assert.match(header, /Source Deck/);
    for (const char of header) {
      assert.ok(char.charCodeAt(0) <= 0x7e, `non-ASCII header char: ${char}`);
    }
  });
});

describe("public Shop booklets", () => {
  it("allows only an available booklet on an active product", () => {
    const product = { is_active: true, status: "active" };
    assert.equal(isPublicShopBooklet({ kind: "booklet", is_available: true }, product), true);
    assert.equal(isPublicShopBooklet({ kind: "deck", is_available: true }, product), false);
    assert.equal(isPublicShopBooklet({ kind: "booklet", is_available: false }, product), false);
    assert.equal(isPublicShopBooklet({ kind: "booklet", is_available: true }, { is_active: false, status: "active" }), false);
    assert.equal(isPublicShopBooklet({ kind: "booklet", is_available: true }, { is_active: true, status: "draft" }), false);
    assert.equal(isPublicShopBooklet({ kind: "manual", is_available: true }, product), false);
  });
});
