import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { headerMap, isOwnerAddress, parseAddressList } from "./headerParse.js";

describe("headerParse", () => {
  it("parses display names and emails", () => {
    const parsed = parseAddressList(`"Jane Public" <Jane.Public@Example.com>, other@test.com`);
    assert.equal(parsed[0]?.email, "Jane.Public@example.com");
    assert.equal(parsed[0]?.firstName, "Jane");
    assert.equal(parsed[1]?.email, "other@test.com");
  });

  it("builds a header map and excludes owner aliases", () => {
    const headers = headerMap([
      { name: "From", value: "Owner <me@example.com>" },
      { name: "To", value: "Friend <friend@example.com>" },
    ]);
    assert.equal(headers.From, "Owner <me@example.com>");
    assert.equal(isOwnerAddress("me@example.com", ["me@example.com", "alias@example.com"]), true);
    assert.equal(isOwnerAddress("friend@example.com", ["me@example.com"]), false);
  });
});
