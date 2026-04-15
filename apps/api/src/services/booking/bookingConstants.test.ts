import assert from "node:assert/strict";
import test from "node:test";
import { sessionTypeRequiresSchedule } from "./bookingConstants.js";

test("sessionTypeRequiresSchedule only requires availability for live sessions", () => {
  assert.equal(sessionTypeRequiresSchedule("focus"), true);
  assert.equal(sessionTypeRequiresSchedule("mentoring"), true);
  assert.equal(sessionTypeRequiresSchedule("regeneration"), false);
  assert.equal(sessionTypeRequiresSchedule("mentoring_circle"), false);
});
