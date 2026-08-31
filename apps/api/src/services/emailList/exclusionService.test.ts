import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createMemoryEmailListStore } from "./emailListStore.js";
import { createExclusionRule, isDuplicateKey } from "./exclusionService.js";

const USER = "11111111-1111-1111-1111-111111111111";

describe("exclusionService", () => {
  it("detects Postgres unique violations wrapped by Drizzle", () => {
    const wrapped = new Error('Failed query: insert into "email_exclusion_rules"') as Error & { cause: { code: string } };
    wrapped.cause = { code: "23505" };
    assert.equal(isDuplicateKey(wrapped), true);
    assert.equal(isDuplicateKey(new Error("network down")), false);
  });

  it("returns a friendly conflict when the filter already exists", async () => {
    const store = createMemoryEmailListStore();
    await createExclusionRule(store, USER, { pattern: "@facebook.com" });
    await assert.rejects(
      () => createExclusionRule(store, USER, { pattern: "@facebook.com" }),
      (error: Error & { statusCode?: number }) => {
        assert.equal(error.statusCode, 409);
        assert.match(error.message, /already on the list/i);
        assert.doesNotMatch(error.message, /Failed query|insert into/i);
        return true;
      },
    );
  });
});
