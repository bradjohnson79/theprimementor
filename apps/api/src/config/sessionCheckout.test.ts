import assert from "node:assert/strict";
import test from "node:test";
import { getSessionCheckoutPath, getSessionCheckoutProductNames } from "./sessionCheckout.js";

test("Q&A session checkout uses the qa public route", () => {
  assert.equal(getSessionCheckoutPath("qa_session"), "/sessions/qa");
});

test("Q&A session checkout exposes the Q&A product label", () => {
  assert.deepEqual(getSessionCheckoutProductNames("qa_session"), ["Q&A Session"]);
});
