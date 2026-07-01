import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canAccessCourseContent } from "./courseEntitlementService.js";

describe("courseEntitlementService", () => {
  it("allows admin course content access without purchase", () => {
    assert.equal(canAccessCourseContent({ role: "admin", entitlement: null }), true);
  });

  it("allows paid non-revoked members", () => {
    assert.equal(canAccessCourseContent({
      role: "member",
      entitlement: {
        purchasedAt: new Date("2026-06-30T00:00:00.000Z"),
        revokedAt: null,
      },
    }), true);
  });

  it("blocks unpaid and revoked members", () => {
    assert.equal(canAccessCourseContent({ role: "member", entitlement: null }), false);
    assert.equal(canAccessCourseContent({
      role: "member",
      entitlement: {
        purchasedAt: new Date("2026-06-30T00:00:00.000Z"),
        revokedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    }), false);
  });
});
