import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { serializeGmailStatus } from "./gmailConnectionService.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../");

function read(rel: string) {
  return readFileSync(path.join(repoRoot, rel), "utf8");
}

describe("Admin Emails architecture", () => {
  it("keeps the Emails page notice and session-only save/commit payloads", () => {
    const page = read("apps/admin/src/pages/Emails.tsx");
    assert.match(page, /data-emails-compliance-notice/);
    assert.match(page, /This tool recovers correspondence/);
    assert.match(page, /searchSessionId,\s*\n\s*candidateIds/);
    assert.match(page, /importSessionId/);
    assert.doesNotMatch(page, /encrypted_tokens|accessToken|refreshToken|GMAIL_TOKEN_ENCRYPTION_KEY/);
    assert.equal(page.includes('api.post("/admin/gmail/candidates/save"'), true);
    assert.doesNotMatch(page, /candidates\/save[\s\S]{0,400}email:/);
    assert.match(page, /Import matching contacts/);
    assert.match(page, /Load 1,000 matches/);
    assert.match(page, /Search year/);
    assert.match(page, /All years/);
    assert.match(page, /Add selected to Contacts/);
    assert.match(page, /CANDIDATE_PAGE_SIZE = 100/);
    assert.match(page, /isPreviewableCandidate/);
    assert.match(page, /dismissCandidates/);
    assert.match(page, /Exclusion filters/);
    assert.match(page, /data-emails-contacts-section/);
    assert.match(page, /Search by email or name/);
    assert.match(page, /Remove selected/);
    assert.match(page, /uniqueNewCsvRows/);
    assert.match(page, /Only unique new addresses remain/);
    assert.match(page, /Email Health/);
    assert.match(page, /Check Email Health/);
    assert.match(page, /Check Email/);
    assert.match(page, /Suppressed/);
    assert.match(page, /Deliverability check passed/);
    assert.match(page, /The domain accepts mail broadly/);
  });

  it("never serializes tokens on Gmail status", () => {
    const payload = serializeGmailStatus({
      status: "connected",
      gmail_address: "me@example.com",
      connected_at: new Date("2026-01-01T00:00:00.000Z"),
    });
    assert.deepEqual(Object.keys(payload).sort(), ["connectedAt", "gmailAddress", "status"]);
    assert.equal(JSON.stringify(payload).includes("token"), false);
  });

  it("does not add Emails tables to schema repair", () => {
    const repair = read("apps/api/src/services/schemaRepairService.ts");
    assert.doesNotMatch(repair, /email_contacts|gmail_connections|gmail_search_sessions|email_csv_import_sessions|email_exclusion_rules|email_suppressions|email_health_checks|email_delivery_events|email_health_jobs/);
  });
});
