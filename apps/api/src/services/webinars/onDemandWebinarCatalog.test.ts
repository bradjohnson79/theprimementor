import assert from "node:assert/strict";
import test from "node:test";
import {
  ADRONIS_ON_DEMAND_DURATION_SECONDS,
  ADRONIS_ON_DEMAND_WEBINAR_ID,
  boundOnDemandProgressSeconds,
  getOnDemandWebinarById,
  isOnDemandWebinarSaleable,
} from "@wisdom/utils";
import { canRequestOnDemandPlayback } from "./onDemandWebinarEntitlementService.js";

test("Adronis on-demand catalog uses per-webinar duration and stays unpublished from live Zoom constants", () => {
  const webinar = getOnDemandWebinarById(ADRONIS_ON_DEMAND_WEBINAR_ID);
  assert.ok(webinar);
  assert.equal(webinar.durationSeconds, ADRONIS_ON_DEMAND_DURATION_SECONDS);
  assert.equal(webinar.kind, "on_demand_recording");
  assert.equal(webinar.priceCents, 799);
  assert.notEqual(webinar.webinarId, "adronis-disclosure-to-contact-2026");
});

test("sales require published + asset ready + playback protected", () => {
  const webinar = { published: true };
  assert.equal(isOnDemandWebinarSaleable(webinar, { assetReady: true, playbackProtected: true }), true);
  assert.equal(isOnDemandWebinarSaleable({ published: false }, { assetReady: true, playbackProtected: true }), false);
  assert.equal(isOnDemandWebinarSaleable(webinar, { assetReady: false, playbackProtected: true }), false);
  assert.equal(isOnDemandWebinarSaleable(webinar, { assetReady: true, playbackProtected: false }), false);
});

test("playback authorization is denied without an active entitlement", () => {
  assert.equal(canRequestOnDemandPlayback({ owned: false, role: "member" }), false);
  assert.equal(canRequestOnDemandPlayback({ owned: true, role: "member" }), true);
  assert.equal(canRequestOnDemandPlayback({ owned: false, role: "admin" }), true);
});

test("progress is bounded to the catalog entry duration, not a global constant", () => {
  assert.equal(boundOnDemandProgressSeconds(9000, 8331), 8331);
  assert.equal(boundOnDemandProgressSeconds(120, 90), 90);
  assert.equal(boundOnDemandProgressSeconds(-12, 8331), 0);
  assert.equal(boundOnDemandProgressSeconds(Number.NaN, 8331), 0);
});
