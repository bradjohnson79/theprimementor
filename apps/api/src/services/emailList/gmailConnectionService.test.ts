import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { completeGmailOAuth, serializeGmailStatus, startGmailOAuth } from "./gmailConnectionService.js";
import { createMemoryEmailListStore } from "./emailListStore.js";
import type { GmailClient } from "./gmailClient.js";

describe("gmailConnectionService oauth", () => {
  let previous: Record<string, string | undefined> = {};

  before(() => {
    previous = {
      GMAIL_TOKEN_ENCRYPTION_KEY: process.env.GMAIL_TOKEN_ENCRYPTION_KEY,
      GOOGLE_GMAIL_CLIENT_ID: process.env.GOOGLE_GMAIL_CLIENT_ID,
      GOOGLE_GMAIL_CLIENT_SECRET: process.env.GOOGLE_GMAIL_CLIENT_SECRET,
      GOOGLE_GMAIL_REDIRECT_URI: process.env.GOOGLE_GMAIL_REDIRECT_URI,
      ADMIN_URL: process.env.ADMIN_URL,
    };
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = "d".repeat(64);
    process.env.GOOGLE_GMAIL_CLIENT_ID = "test-client";
    process.env.GOOGLE_GMAIL_CLIENT_SECRET = "test-secret";
    process.env.GOOGLE_GMAIL_REDIRECT_URI = "http://127.0.0.1:3001/api/admin/gmail/oauth/callback";
    process.env.ADMIN_URL = "http://127.0.0.1:5174";
  });

  after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("starts oauth with a stored state and readonly scope", async () => {
    const store = createMemoryEmailListStore();
    const started = await startGmailOAuth(store, "admin-a");
    assert.match(started.url, /gmail\.readonly/);
    assert.match(started.url, /code_challenge/);
    assert.equal(store.oauthStates.length, 1);
    assert.equal(store.oauthStates[0]?.user_id, "admin-a");
  });

  it("rejects a missing or expired oauth state without putting tokens in the redirect", async () => {
    const store = createMemoryEmailListStore();
    const url = await completeGmailOAuth(store, { code: "abc", state: "nope" });
    assert.equal(url, "http://127.0.0.1:5174/admin/emails?gmail=invalid_state");
    assert.doesNotMatch(url, /access|refresh|token/i);
  });

  it("stores encrypted tokens after a successful callback", async () => {
    const store = createMemoryEmailListStore();
    const started = await startGmailOAuth(store, "admin-a");
    const state = new URL(started.url).searchParams.get("state") ?? "";
    const client: GmailClient = {
      async exchangeCode() {
        return { accessToken: "access-secret", refreshToken: "refresh-secret", expiryDate: Date.now() + 1000 };
      },
      async refreshAccessToken() {
        return { accessToken: "access-secret", refreshToken: "refresh-secret" };
      },
      async revokeToken() {},
      async getProfile() {
        return { emailAddress: "me@example.com" };
      },
      async listMessageIds() {
        return { ids: [], nextPageToken: null };
      },
      async getMessageMetadata() {
        return { id: "", threadId: "", headers: [] };
      },
      async getThreadMetadata() {
        return { id: "", messages: [] };
      },
    };
    const url = await completeGmailOAuth(store, { code: "ok", state }, client);
    assert.equal(url, "http://127.0.0.1:5174/admin/emails?gmail=connected");
    const connection = await store.getConnection("admin-a");
    assert.ok(connection);
    assert.doesNotMatch(connection.encrypted_tokens, /access-secret|refresh-secret/);
    const publicStatus = serializeGmailStatus(connection);
    assert.equal(JSON.stringify(publicStatus).includes("encrypted"), false);
    assert.equal(JSON.stringify(publicStatus).includes("access"), false);
  });
});
