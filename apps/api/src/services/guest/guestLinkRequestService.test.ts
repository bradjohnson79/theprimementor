import assert from "node:assert/strict";
import test from "node:test";
import {
  GUEST_LINK_COOLDOWN_MS,
  GUEST_LINK_MAX_PER_HOUR,
  decideGuestLinkThrottle,
  handleGuestLinkRequest,
  type GuestLinkRequestDeps,
} from "./guestLinkRequestService.js";

const NOW = new Date("2026-10-23T20:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);

test("throttle: allows when nothing was sent recently", () => {
  assert.deepEqual(decideGuestLinkThrottle([], NOW), { allowed: true });
});

test("throttle: per-address cooldown blocks a second email within 60s", () => {
  assert.deepEqual(decideGuestLinkThrottle([ago(GUEST_LINK_COOLDOWN_MS - 1)], NOW), { allowed: false, reason: "cooldown" });
  assert.deepEqual(decideGuestLinkThrottle([ago(GUEST_LINK_COOLDOWN_MS + 1)], NOW), { allowed: true });
});

test("throttle: hourly cap per address", () => {
  const sent = Array.from({ length: GUEST_LINK_MAX_PER_HOUR }, (_, i) => ago(5 * 60_000 + i * 60_000));
  assert.deepEqual(decideGuestLinkThrottle(sent, NOW), { allowed: false, reason: "hourly_cap" });
  assert.deepEqual(decideGuestLinkThrottle(sent.slice(1), NOW), { allowed: true });
  // entries older than the window don't count
  assert.deepEqual(decideGuestLinkThrottle(sent.map((d) => new Date(d.getTime() - 60 * 60_000)), NOW), { allowed: true });
});

function deps(overrides: Partial<GuestLinkRequestDeps> = {}) {
  const sent: Array<[string, string]> = [];
  const d: GuestLinkRequestDeps = {
    normalizeEmail: (raw) => {
      if (typeof raw !== "string" || !raw.includes("@")) throw new Error("invalid");
      return raw.trim().toLowerCase();
    },
    findUser: async () => ({ userId: "guest-1", isRealAccount: false }),
    hasOrders: async () => true,
    recentIssues: async () => [],
    send: async (userId, email) => {
      sent.push([userId, email]);
    },
    now: () => NOW,
    ...overrides,
  };
  return { d, sent };
}

test("link request: sends for an existing guest with orders", async () => {
  const { d, sent } = deps();
  assert.equal(await handleGuestLinkRequest(d, { email: " Guest@Example.com ", honeypotTripped: false }), "sent");
  assert.deepEqual(sent, [["guest-1", "guest@example.com"]]);
});

test("link request: never sends (and never creates anything) for unknown, real, empty, throttled, honeypot, invalid", async () => {
  const cases: Array<[string, Partial<GuestLinkRequestDeps>, { email: unknown; honeypotTripped: boolean }]> = [
    ["no_user", { findUser: async () => null }, { email: "a@b.co", honeypotTripped: false }],
    ["real_account", { findUser: async () => ({ userId: "real-1", isRealAccount: true }) }, { email: "a@b.co", honeypotTripped: false }],
    ["no_orders", { hasOrders: async () => false }, { email: "a@b.co", honeypotTripped: false }],
    ["throttled", { recentIssues: async () => [ago(10_000)] }, { email: "a@b.co", honeypotTripped: false }],
    ["honeypot", {}, { email: "a@b.co", honeypotTripped: true }],
    ["invalid_email", {}, { email: "nope", honeypotTripped: false }],
    ["error", { findUser: async () => { throw new Error("db down"); } }, { email: "a@b.co", honeypotTripped: false }],
  ];
  for (const [expected, overrides, input] of cases) {
    const { d, sent } = deps(overrides);
    assert.equal(await handleGuestLinkRequest(d, input), expected, expected);
    assert.equal(sent.length, 0, `${expected} must not send`);
  }
});
