import assert from "node:assert/strict";
import test from "node:test";
import type { AdminOrder } from "../ordersService.js";
import { mapOrderToDivin8Input } from "./orderToDivin8Input.js";

test("mapOrderToDivin8Input includes report intake timezone", () => {
  const order = {
    type: "report",
    user_id: "user-1",
    id: "report_5a145ef3-a9d0-4f44-8f9e-a289dea33d9c",
    source_id: "5a145ef3-a9d0-4f44-8f9e-a289dea33d9c",
    client_name: "UTPAL THAKAR",
    email: "utpalthakar@gmail.com",
    metadata: {
      birth_date: "1987-10-01",
      birth_time: "04:58",
      birth_location: "Belgaum, India",
      report_type: "Initiate",
      report_type_id: "initiate",
      selected_systems: ["astrology", "numerology", "humanDesign", "chinese", "kabbalah", "rune"],
      session_type: null,
      raw_intake: {
        birthTimezone: "IST",
      },
      intake: {
        birth_date: "1987-10-01",
        birth_time: "04:58",
        location: "Belgaum, India",
        timezone: "IST",
        submitted_questions: [],
        notes: "Client notes",
      },
    },
  } as unknown as AdminOrder;

  const input = mapOrderToDivin8Input(order);

  assert.equal(input.timezone, "IST");
  assert.equal(input.metadata?.timezone, "IST");
  assert.equal(input.metadata?.birth_timezone, "IST");
  assert.equal(input.birth_location, "Belgaum, India");
});
