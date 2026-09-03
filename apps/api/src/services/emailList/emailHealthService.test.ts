import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createManualContact } from "./contactService.js";
import { classifyCsvRow } from "./csv.js";
import { buildCandidatesFromThreads } from "./candidateBuild.js";
import { createMemoryEmailListStore } from "./emailListStore.js";
import {
  applyHealthOutcome,
  applySoftBounce,
  checkContactHealth,
  evaluateAddressHealth,
} from "./emailHealthService.js";
import { handleBrevoDeliveryEvent, mapBrevoEvent, verifyBrevoWebhookSecret } from "./brevoDeliveryWebhook.js";
import { startHealthCheckJob } from "./emailHealthJobService.js";
import { restoreSuppression } from "./emailSuppressionService.js";
import { exportEmailContactsCsv } from "./contactService.js";
import type { DnsLookup, EmailHealthVerifier } from "./emailHealthVerifier.js";

const ADMIN = "11111111-1111-1111-1111-111111111111";

function dnsWith(outcome: { mx?: boolean; a?: boolean; timeout?: boolean; error?: boolean }): DnsLookup {
  return {
    async resolveMx() {
      if (outcome.timeout) {
        const error = new Error("timeout") as Error & { code: string };
        error.code = "ETIMEOUT";
        throw error;
      }
      if (outcome.error) throw new Error("dns failed");
      if (outcome.mx) return [{ exchange: "mx.example.com", priority: 10 }];
      const error = new Error("no mx") as Error & { code: string };
      error.code = "ENODATA";
      throw error;
    },
    async resolve4() {
      if (outcome.timeout) {
        const error = new Error("timeout") as Error & { code: string };
        error.code = "ETIMEOUT";
        throw error;
      }
      if (outcome.a) return ["1.2.3.4"];
      return [];
    },
    async resolve6() {
      return [];
    },
  };
}

function verifier(result: Awaited<ReturnType<EmailHealthVerifier["checkMailbox"]>>): EmailHealthVerifier {
  return { async checkMailbox() { return result; } };
}

async function addContact(store: ReturnType<typeof createMemoryEmailListStore>, email = "ada@example.com") {
  return createManualContact(store, ADMIN, { email, firstName: "Ada" });
}

describe("email health check", () => {
  it("purges only definitive invalid syntax and missing mail service", async () => {
    const syntax = await evaluateAddressHealth("not-an-email", { dns: dnsWith({ mx: true }) });
    assert.equal(syntax.status, "invalid");
    assert.equal(syntax.definitive, true);

    const missing = await evaluateAddressHealth("ada@gone.example", {
      dns: dnsWith({}),
      verifier: verifier({ status: "unknown", reason: "unused", definitive: false }),
    });
    assert.equal(missing.status, "invalid");
    assert.equal(missing.source, "dns");

    const timeout = await evaluateAddressHealth("ada@slow.example", {
      dns: dnsWith({ timeout: true }),
    });
    assert.equal(timeout.status, "unknown");
    assert.equal(timeout.definitive, false);

    const catchAll = await evaluateAddressHealth("ada@example.com", {
      dns: dnsWith({ mx: true }),
      verifier: verifier({
        status: "catch_all",
        reason: "The domain accepts mail broadly, so mailbox existence could not be confirmed.",
        definitive: false,
      }),
    });
    assert.equal(catchAll.status, "catch_all");
    assert.equal(catchAll.definitive, false);
  });

  it("hard bounce removes the contact, writes suppression, and blocks re-import", async () => {
    const store = createMemoryEmailListStore();
    const contact = await addContact(store);
    const result = await applyHealthOutcome(store, store.contacts[0]!, {
      status: "hard_bounce",
      source: "brevo",
      reason: "mailbox does not exist",
      definitive: true,
      providerEventId: "evt-1",
    });
    assert.equal(result.purged, true);
    assert.equal(store.contacts.length, 0);
    assert.equal(store.suppressions.length, 1);

    await assert.rejects(
      () => createManualContact(store, ADMIN, { email: contact.email }),
      /Previously removed due to hard bounce/,
    );

    const csv = classifyCsvRow(2, contact.email, "Ada", new Set(), new Set(), [], await store.existingSuppressedEmails());
    assert.equal(csv.status, "suppressed");

    const candidates = buildCandidatesFromThreads({
      threads: [{
        id: "t1",
        messages: [{
          id: "m1",
          threadId: "t1",
          headers: [
            { name: "From", value: `Ada <${contact.email}>` },
            { name: "To", value: "Owner <me@example.com>" },
          ],
        }],
      }],
      matchingMessageIds: new Set(["m1"]),
      query: "hello",
      ownerAddresses: ["me@example.com"],
      existing: { has: () => false },
      suppressed: { has: (email) => store.suppressions.some((row) => row.email_normalized === email) },
    });
    assert.equal(candidates[0]?.status, "suppressed");
  });

  it("soft bounce keeps the contact and does not suppress", async () => {
    const store = createMemoryEmailListStore();
    await addContact(store);
    await applySoftBounce(store, store.contacts[0]!, "mailbox full");
    assert.equal(store.contacts.length, 1);
    assert.equal(store.contacts[0]?.health_status, "soft_bounce");
    assert.equal(store.suppressions.length, 0);
    await applySoftBounce(store, store.contacts[0]!, "mailbox full");
    await applySoftBounce(store, store.contacts[0]!, "mailbox full");
    assert.equal(store.contacts[0]?.health_status, "risky");
    assert.equal(store.contacts[0]?.soft_bounce_count, 3);
    assert.equal(store.suppressions.length, 0);
  });

  it("unsubscribe events are not bounces", async () => {
    assert.equal(mapBrevoEvent("unsubscribe"), "unsubscribed");
    const store = createMemoryEmailListStore();
    await addContact(store);
    const result = await handleBrevoDeliveryEvent(store, {
      event: "unsubscribed",
      email: "ada@example.com",
      id: "u1",
    });
    assert.equal(result.kind, "unsubscribed");
    assert.equal(store.contacts.length, 1);
    assert.equal(store.suppressions.length, 0);
  });

  it("Brevo hard bounce suppresses even if the contact is already gone", async () => {
    const store = createMemoryEmailListStore();
    const result = await handleBrevoDeliveryEvent(store, {
      event: "hardBounce",
      email: "gone@example.com",
      id: "hb1",
      reason: "user unknown",
    });
    assert.equal(result.suppressed, true);
    assert.equal(store.suppressions[0]?.email_normalized, "gone@example.com");
  });

  it("does not overwrite a delivered result with a weaker invalid re-check", async () => {
    const store = createMemoryEmailListStore();
    await addContact(store);
    await handleBrevoDeliveryEvent(store, { event: "delivered", email: "ada@example.com", id: "d1" });
    assert.equal(store.contacts[0]?.health_status, "deliverable");
    const result = await applyHealthOutcome(store, store.contacts[0]!, {
      status: "invalid",
      source: "mailbox",
      reason: "ambiguous smtp",
      definitive: false,
    });
    assert.equal(result.purged, false);
    assert.equal(store.contacts[0]?.health_status, "deliverable");
  });

  it("leaves the contact unchanged when a check throws", async () => {
    const store = createMemoryEmailListStore();
    const created = await addContact(store);
    await assert.rejects(() => checkContactHealth(store, created.id, {
      dns: dnsWith({ mx: true }),
      verifier: { async checkMailbox() { throw new Error("verifier offline"); } },
    }));
    assert.equal(store.contacts[0]?.id, created.id);
    assert.equal(store.contacts[0]?.health_status, "unchecked");
  });

  it("export excludes suppressed and known-bad addresses", async () => {
    const store = createMemoryEmailListStore();
    await addContact(store, "good@example.com");
    await addContact(store, "bad@example.com");
    await applyHealthOutcome(store, store.contacts.find((row) => row.email === "bad@example.com")!, {
      status: "invalid",
      source: "dns",
      reason: "Domain has no mail service.",
      definitive: true,
    });
    const csv = await exportEmailContactsCsv(store);
    assert.match(csv, /good@example.com/);
    assert.doesNotMatch(csv, /bad@example.com/);
  });

  it("restore requires explicit confirm", async () => {
    const store = createMemoryEmailListStore();
    const suppression = await store.insertSuppression({
      email_normalized: "ada@example.com",
      reason: "hard_bounce",
      source: "brevo",
    });
    await assert.rejects(() => restoreSuppression(store, suppression.id, {}), /confirm/);
    const restored = await restoreSuppression(store, suppression.id, { confirm: true });
    assert.equal(restored.restored, true);
    assert.equal(store.suppressions.length, 0);
  });

  it("verifier offline during a job does not delete contacts", async () => {
    const store = createMemoryEmailListStore();
    await addContact(store);
    const job = await startHealthCheckJob(store, ADMIN, { scope: "all_active", force: true }, {
      verifier: {
        async checkMailbox() { throw new Error("verifier offline"); },
      },
      dns: dnsWith({ mx: true }),
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    const latest = await store.getHealthJob(job.id);
    assert.equal(store.contacts.length, 1);
    assert.ok(latest);
  });

  it("does not treat policy blocks or unsubscribed mailboxes as hard bounces", () => {
    assert.equal(mapBrevoEvent("blocked", "message rejected due to content policy"), "blocked");
    assert.equal(mapBrevoEvent("blocked", "unsubscribed mailbox"), "blocked");
    assert.equal(mapBrevoEvent("blocked", "user unknown"), "hard_bounce");
    assert.equal(mapBrevoEvent("blocked", "permanent failure"), "hard_bounce");
  });

  it("checks explicitly selected contacts even if they were recently checked", async () => {
    const store = createMemoryEmailListStore();
    const created = await addContact(store);
    store.contacts[0]!.health_checked_at = new Date();
    const selected = await store.listContactsForHealthScope({
      scope: "ids",
      ids: [created.id],
    });
    assert.equal(selected.length, 1);
    const staleOnly = await store.listContactsForHealthScope({
      scope: "all_active",
    });
    assert.equal(staleOnly.length, 0);
  });

  it("verifies the Brevo webhook secret", () => {
    assert.equal(verifyBrevoWebhookSecret("secret", { "x-webhook-secret": "secret" }, {}), true);
    assert.equal(verifyBrevoWebhookSecret("secret", { authorization: "Bearer secret" }, {}), true);
    assert.equal(verifyBrevoWebhookSecret("secret", {}, { token: "secret" }), true);
    assert.equal(verifyBrevoWebhookSecret("secret", { "x-webhook-secret": "nope" }, {}), false);
    assert.equal(verifyBrevoWebhookSecret(undefined, { "x-webhook-secret": "secret" }, {}), false);
  });
});
