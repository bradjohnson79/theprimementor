import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { memberSubscriptionActions } from "./memberSubscriptionsService.js";

describe("memberSubscriptionActions", () => {
  it("lets a cancelling membership renew and not cancel again", () => {
    assert.deepEqual(memberSubscriptionActions("cancelling"), {
      cancelable: false,
      pauseable: false,
      renewable: true,
    });
  });

  it("keeps active memberships cancelable and pauseable", () => {
    assert.deepEqual(memberSubscriptionActions("active"), {
      cancelable: true,
      pauseable: true,
      renewable: false,
    });
  });

  it("does not treat a fully ended membership as immediately renewable", () => {
    assert.deepEqual(memberSubscriptionActions("canceled"), {
      cancelable: false,
      pauseable: false,
      renewable: false,
    });
  });
});
