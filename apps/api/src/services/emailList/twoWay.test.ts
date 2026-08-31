import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectTwoWay, messageDates } from "./twoWay.js";

describe("twoWay", () => {
  it("counts a reply without the search keyword as two-way", () => {
    const result = detectTwoWay([
      {
        from: ["me@example.com"],
        to: ["jane@client.com"],
        date: "2026-01-01T12:00:00.000Z",
      },
      {
        from: ["jane@client.com"],
        to: ["me@example.com"],
        date: "2026-01-02T12:00:00.000Z",
      },
    ], "jane@client.com", ["me@example.com"]);
    assert.equal(result.sent, 1);
    assert.equal(result.received, 1);
    assert.equal(result.twoWay, true);
  });

  it("is not two-way when only one direction exists", () => {
    const result = detectTwoWay([
      { from: ["me@example.com"], to: ["jane@client.com"] },
    ], "jane@client.com", ["me@example.com"]);
    assert.equal(result.twoWay, false);
  });

  it("returns first and last dates", () => {
    const dates = messageDates([
      { from: [], to: [], date: "2026-02-01T00:00:00.000Z" },
      { from: [], to: [], date: "2026-01-01T00:00:00.000Z" },
    ]);
    assert.equal(dates.first?.toISOString(), "2026-01-01T00:00:00.000Z");
    assert.equal(dates.last?.toISOString(), "2026-02-01T00:00:00.000Z");
  });
});
