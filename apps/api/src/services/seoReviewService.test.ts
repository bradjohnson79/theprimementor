import assert from "node:assert/strict";
import test from "node:test";
import { __seoReviewTestUtils } from "./seoReviewService.js";

test("assertExpectedVersion rejects stale or missing optimistic lock values", () => {
  assert.doesNotThrow(() => __seoReviewTestUtils.assertExpectedVersion(3));
  assert.throws(
    () => __seoReviewTestUtils.assertExpectedVersion(Number.NaN),
    /expectedVersion is required/,
  );
});
