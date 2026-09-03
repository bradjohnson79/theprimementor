import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createManualContact, dedupeStoredContacts, exportEmailContactsCsv, listEmailContacts } from "./contactService.js";
import { commitCsvImport, previewCsvImport } from "./csvImportService.js";
import { createMemoryEmailListStore, type EmailListStore } from "./emailListStore.js";
import { disconnectGmail } from "./gmailConnectionService.js";
import { encryptTokenPayload } from "./tokenCrypto.js";
import { importGmailMatches, saveGmailCandidates, searchGmailCandidates } from "./gmailSearchService.js";
import type { GmailClient } from "./gmailClient.js";

const ADMIN_A = "11111111-1111-1111-1111-111111111111";
const ADMIN_B = "22222222-2222-2222-2222-222222222222";

async function connectAdmin(store: EmailListStore, userId: string, address = "me@example.com") {
  await store.upsertConnection({
    user_id: userId,
    gmail_address: address,
    encrypted_tokens: encryptTokenPayload({
      accessToken: "access",
      refreshToken: "refresh",
      expiryDate: Date.now() + 3600_000,
    }),
    token_expires_at: new Date(Date.now() + 3600_000),
    granted_scope: "https://www.googleapis.com/auth/gmail.readonly",
    status: "connected",
  });
}

function mockGmail(): GmailClient {
  return {
    async exchangeCode() {
      return { accessToken: "access", refreshToken: "refresh", expiryDate: Date.now() + 3600_000 };
    },
    async refreshAccessToken() {
      return { accessToken: "access", refreshToken: "refresh", expiryDate: Date.now() + 3600_000 };
    },
    async revokeToken() {},
    async getProfile() {
      return { emailAddress: "me@example.com" };
    },
    async listMessageIds(_token, _query, pageToken) {
      if (pageToken === "page-2") {
        return { ids: [{ id: "m2", threadId: "t2" }], nextPageToken: null };
      }
      return { ids: [{ id: "m1", threadId: "t1" }], nextPageToken: "page-2" };
    },
    async getMessageMetadata(_token, id) {
      return {
        id,
        threadId: id === "m2" ? "t2" : "t1",
        headers: [
          { name: "From", value: "Jane Client <jane@client.com>" },
          { name: "To", value: "Owner <me@example.com>" },
          { name: "Subject", value: "Mentoring" },
          { name: "Date", value: "Mon, 1 Jan 2026 12:00:00 +0000" },
        ],
      };
    },
    async getThreadMetadata(_token, id) {
      return {
        id,
        messages: [
          {
            id: id === "t2" ? "m2" : "m1",
            threadId: id,
            headers: [
              { name: "From", value: "Jane Client <jane@client.com>" },
              { name: "To", value: "Owner <me@example.com>" },
              { name: "Subject", value: "Mentoring" },
            ],
          },
          {
            id: `${id}-reply`,
            threadId: id,
            headers: [
              { name: "From", value: "Owner <me@example.com>" },
              { name: "To", value: "Jane Client <jane@client.com>" },
              { name: "Subject", value: "Re: thanks" },
            ],
          },
        ],
      };
    },
  };
}

describe("email list isolation and sessions", () => {
  let previousKey: string | undefined;

  before(() => {
    previousKey = process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "b".repeat(64);
  });

  after(() => {
    if (previousKey === undefined) delete process.env.GMAIL_TOKEN_ENCRYPTION_KEY;
    else process.env.GMAIL_TOKEN_ENCRYPTION_KEY = previousKey;
  });

  it("keeps Gmail status, profiles, search sessions, and CSV sessions owner-isolated", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A, "a@example.com");
    const profile = await store.createProfile(ADMIN_A, "Mentoring", "mentoring");
    assert.equal((await store.listProfiles(ADMIN_B)).length, 0);
    assert.equal(await store.getProfile(ADMIN_B, profile.id), null);
    assert.equal(await store.getConnection(ADMIN_B), null);

    const search = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring" }, mockGmail());
    assert.equal(await store.getSearchSession(ADMIN_B, search.searchSessionId), null);

    await assert.rejects(
      () => saveGmailCandidates(store, ADMIN_B, {
        searchSessionId: search.searchSessionId,
        candidateIds: [search.candidates[0]!.id],
      }),
      /search session not found/i,
    );

    const preview = await previewCsvImport(store, ADMIN_A, {
      filename: "contacts.csv",
      mimetype: "text/csv",
      buffer: Buffer.from("email,first_name\nb@example.com,Bea\n"),
    });
    assert.equal(await store.getCsvSession(ADMIN_B, preview.importSessionId), null);
    await assert.rejects(
      () => commitCsvImport(store, ADMIN_B, { importSessionId: preview.importSessionId }),
      /not found/i,
    );
  });

  it("lets both admins manage the shared master list and records imported_by_user_id", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    const created = await createManualContact(store, ADMIN_A, { email: "shared@example.com", firstName: "Sam" });
    const listed = await listEmailContacts(store, {});
    assert.equal(listed.contacts.some((row) => row.email === "shared@example.com"), true);
    const byEmail = await listEmailContacts(store, { search: "shared@example" });
    assert.equal(byEmail.contacts.length, 1);
    assert.equal(byEmail.contacts[0]?.email, "shared@example.com");
    const missed = await listEmailContacts(store, { search: "nobody@example.com" });
    assert.equal(missed.contacts.length, 0);
    const row = store.contacts.find((item) => item.id === created.id);
    assert.equal(row?.imported_by_user_id, ADMIN_A);

    const search = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring" }, mockGmail());
    await saveGmailCandidates(store, ADMIN_A, {
      searchSessionId: search.searchSessionId,
      candidateIds: [search.candidates[0]!.id],
    });
    assert.equal(store.evidence[0]?.imported_by_user_id, ADMIN_A);

    store.contacts.push({
      id: "33333333-3333-3333-3333-333333333333",
      first_name: null,
      email: "Shared@Example.com",
      email_normalized: "Shared@Example.com",
      source: "csv",
      source_reference: null,
      imported_by_user_id: ADMIN_B,
      health_status: "unchecked",
      health_checked_at: null,
      health_source: null,
      health_reason: null,
      last_bounce_at: null,
      bounce_count: 0,
      soft_bounce_count: 0,
      last_soft_bounce_at: null,
      created_at: new Date("2026-01-01T00:00:00.000Z"),
      updated_at: null,
    });
    const collapsed = await dedupeStoredContacts(store);
    assert.equal(collapsed.removed, 1);
    assert.equal(store.contacts.filter((row) => row.email.toLowerCase() === "shared@example.com").length, 1);

    const csv = await exportEmailContactsCsv(store);
    assert.match(csv, /^email,first_name\n/);
    assert.doesNotMatch(csv, /imported_by/);
    assert.doesNotMatch(csv, /gmail_address|encrypted_tokens|source/);
  });

  it("rejects client-submitted CSV rows and Gmail emails on save/commit", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    const preview = await previewCsvImport(store, ADMIN_A, {
      filename: "contacts.csv",
      mimetype: "text/csv",
      buffer: Buffer.from("email,first_name\nlegit@example.com,Lee\n"),
    });
    await assert.rejects(
      () => commitCsvImport(store, ADMIN_A, {
        importSessionId: preview.importSessionId,
        rows: [{ email: "forged@example.com", firstName: "Forge" }],
      }),
      /only importSessionId/i,
    );
    const committed = await commitCsvImport(store, ADMIN_A, { importSessionId: preview.importSessionId });
    assert.equal(committed.added, 1);
    assert.equal(store.contacts.some((row) => row.email === "forged@example.com"), false);

    const dupPreview = await previewCsvImport(store, ADMIN_A, {
      filename: "again.csv",
      mimetype: "text/csv",
      buffer: Buffer.from("email,first_name\nLegit@Example.com,Lee\nlee.other@example.com,Lee\n"),
    });
    const statuses = dupPreview.preview.rows.map((row) => row.status);
    assert.deepEqual(statuses, ["exists", "new"]);
    const dupCommit = await commitCsvImport(store, ADMIN_A, { importSessionId: dupPreview.importSessionId });
    assert.equal(dupCommit.added, 1);
    assert.equal(dupCommit.alreadyExisted, 1);
    assert.equal(store.contacts.filter((row) => row.email_normalized === "legit@example.com").length, 1);
    assert.equal(store.contacts[0]?.imported_by_user_id, ADMIN_A);

    const search = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring" }, mockGmail());
    await assert.rejects(
      () => saveGmailCandidates(store, ADMIN_A, {
        searchSessionId: search.searchSessionId,
        candidateIds: [search.candidates[0]!.id],
        email: "forged@example.com",
        firstName: "Forge",
      }),
      /searchSessionId and candidateIds/i,
    );
  });

  it("paginates mocked Gmail threads and saves idempotently", async () => {
    const store = createMemoryEmailListStore();
    await store.upsertConnection({
      user_id: ADMIN_A,
      gmail_address: "me@example.com",
      encrypted_tokens: encryptTokenPayload({ accessToken: "access", refreshToken: "refresh", expiryDate: Date.now() + 3600_000 }),
      token_expires_at: new Date(Date.now() + 3600_000),
      granted_scope: "https://www.googleapis.com/auth/gmail.readonly",
      status: "connected",
    });
    const first = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring", batchSize: 1 }, mockGmail());
    assert.equal(first.nextPageToken, "page-2");
    assert.equal(first.hasMore, true);
    const second = await searchGmailCandidates(store, ADMIN_A, {
      query: "mentoring",
      searchSessionId: first.searchSessionId,
      pageToken: "page-2",
      batchSize: 1,
    }, mockGmail());
    assert.equal(second.nextPageToken, null);
    assert.equal(second.candidates.length, 1);
    const firstSave = await saveGmailCandidates(store, ADMIN_A, {
      searchSessionId: first.searchSessionId,
      candidateIds: [first.candidates[0]!.id],
    });
    const secondSave = await saveGmailCandidates(store, ADMIN_A, {
      searchSessionId: first.searchSessionId,
      candidateIds: [first.candidates[0]!.id],
    });
    assert.equal(firstSave.added, 1);
    assert.equal(secondSave.added, 0);
    assert.equal(secondSave.existing, 1);
    assert.equal(store.contacts.filter((row) => row.email_normalized === "jane@client.com").length, 1);
  });

  it("still saves selected candidates after the preview session TTL lapses", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    const loaded = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring" }, mockGmail());
    const session = await store.getSearchSession(ADMIN_A, loaded.searchSessionId);
    assert.ok(session);
    await store.updateSearchSession(ADMIN_A, session.id, { expires_at: new Date(Date.now() - 1000) });
    assert.equal(await store.getSearchSession(ADMIN_A, session.id), null);
    const saved = await saveGmailCandidates(store, ADMIN_A, {
      searchSessionId: loaded.searchSessionId,
      candidateIds: [loaded.candidates[0]!.id],
    });
    assert.equal(saved.added, 1);
    assert.equal(store.contacts[0]?.email_normalized, "jane@client.com");
  });

  it("applies a selected year to the Gmail search query", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    const queries: string[] = [];
    const client = mockGmail();
    const originalList = client.listMessageIds.bind(client);
    client.listMessageIds = async (token, query, pageToken, maxResults) => {
      queries.push(query);
      return originalList(token, query, pageToken, maxResults);
    };
    await searchGmailCandidates(store, ADMIN_A, { query: "Adronis", year: 2024, batchSize: 1 }, client);
    assert.equal(queries[0], "Adronis after:2024/01/01 before:2025/01/01");
  });

  it("loads a full 1,000-size batch across Gmail pages in one search", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    const loaded = await searchGmailCandidates(store, ADMIN_A, { query: "mentoring" }, mockGmail());
    assert.equal(loaded.hasMore, false);
    assert.equal(loaded.nextPageToken, null);
    assert.equal(loaded.candidates.length, 1);
    assert.equal(loaded.batchPages, 2);
    assert.equal(loaded.total, 1);
  });

  it("auto-imports keyword matches and skips exclusion-list addresses", async () => {
    const store = createMemoryEmailListStore();
    await connectAdmin(store, ADMIN_A);
    await store.insertExclusion({
      kind: "email",
      value: "jane@client.com",
      pattern: "jane@client.com",
      created_by_user_id: ADMIN_A,
    });
    const skipped = await importGmailMatches(store, ADMIN_A, { query: "Adronis" }, mockGmail());
    assert.equal(skipped.added, 0);
    assert.equal(skipped.filtered, 1);
    assert.equal(store.contacts.length, 0);

    await store.deleteExclusion((await store.listExclusions())[0]!.id);
    const imported = await importGmailMatches(store, ADMIN_A, { query: "Adronis" }, mockGmail());
    assert.equal(imported.added, 1);
    assert.equal(imported.pages, 2);
    assert.equal(imported.hasMore, false);
    assert.equal(imported.candidates.length, 1);
    assert.equal(store.contacts[0]?.email_normalized, "jane@client.com");
    assert.equal(store.contacts[0]?.imported_by_user_id, ADMIN_A);

    const again = await importGmailMatches(store, ADMIN_A, { query: "Adronis" }, mockGmail());
    assert.equal(again.added, 0);
    assert.equal(again.existing, 1);
    assert.equal(store.contacts.length, 1);
  });


  it("decrypts then deletes then revokes on disconnect", async () => {
    const store = createMemoryEmailListStore();
    const order: string[] = [];
    await store.upsertConnection({
      user_id: ADMIN_A,
      gmail_address: "me@example.com",
      encrypted_tokens: encryptTokenPayload({ accessToken: "access-secret", refreshToken: "refresh-secret" }),
      token_expires_at: null,
      granted_scope: "https://www.googleapis.com/auth/gmail.readonly",
      status: "connected",
    });
    const client = mockGmail();
    client.revokeToken = async (token) => {
      assert.equal(await store.getConnection(ADMIN_A), null);
      assert.equal(token, "refresh-secret");
      order.push("revoke");
    };
    const result = await disconnectGmail(store, ADMIN_A, client);
    assert.equal(result.disconnected, true);
    assert.deepEqual(order, ["revoke"]);
  });
});
