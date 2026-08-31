import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { completeGoogleAdsOAuth, getValidAdsAccessToken, startGoogleAdsOAuth } from "./googleAdsOAuthService.js";
import { decryptAdsGoogleTokens } from "./adsTokenCrypto.js";
import { createMemoryAdsGoogleStore } from "./googleAdsStore.js";
import type { AdsGoogleOAuthClient } from "./googleAdsOAuthClient.js";
import { GOOGLE_ADS_SCOPE } from "./googleAdsIds.js";

function fakeClient(tokens: { accessToken: string; refreshToken: string }): AdsGoogleOAuthClient {
  return {
    async exchangeCode() {
      return { ...tokens, expiryDate: Date.now() + 60_000, scope: GOOGLE_ADS_SCOPE };
    },
    async refreshAccessToken(refreshToken) {
      return { accessToken: "access-refreshed", refreshToken };
    },
    async revokeToken() {},
  };
}

describe("Google Ads OAuth service", () => {
  let previous: Record<string, string | undefined> = {};

  before(() => {
    previous = {
      ADS_TOKEN_ENCRYPTION_KEY: process.env.ADS_TOKEN_ENCRYPTION_KEY,
      GOOGLE_ADS_CLIENT_ID: process.env.GOOGLE_ADS_CLIENT_ID,
      GOOGLE_ADS_CLIENT_SECRET: process.env.GOOGLE_ADS_CLIENT_SECRET,
      GOOGLE_ADS_REDIRECT_URI: process.env.GOOGLE_ADS_REDIRECT_URI,
      ADMIN_URL: process.env.ADMIN_URL,
    };
    process.env.ADS_TOKEN_ENCRYPTION_KEY = "b".repeat(64);
    process.env.GOOGLE_ADS_CLIENT_ID = "ads-client";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "ads-secret";
    process.env.GOOGLE_ADS_REDIRECT_URI = "http://127.0.0.1:3001/api/admin/ads/google/oauth/callback";
    process.env.ADMIN_URL = "http://127.0.0.1:5174";
  });

  after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("starts oauth with Ads scope, offline access, consent, and state", async () => {
    const store = createMemoryAdsGoogleStore();
    const started = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    const url = new URL(started.url);
    assert.equal(url.searchParams.get("scope"), GOOGLE_ADS_SCOPE);
    assert.equal(url.searchParams.get("access_type"), "offline");
    assert.equal(url.searchParams.get("prompt"), "consent");
    assert.ok(url.searchParams.get("state"));
    assert.ok(url.searchParams.get("code_challenge"));
    assert.doesNotMatch(started.url, /ads-secret|GOCSPX|developer/i);
    assert.equal(store.oauthStates.length, 1);
  });

  it("rejects invalid or denied callbacks without leaking tokens", async () => {
    const store = createMemoryAdsGoogleStore();
    const invalid = await completeGoogleAdsOAuth(store, { code: "abc", state: "nope" });
    assert.equal(invalid, "http://127.0.0.1:5174/admin/ads/settings?ads=invalid_state");
    assert.doesNotMatch(invalid, /access|refresh|token/i);
    const denied = await completeGoogleAdsOAuth(store, { error: "access_denied" });
    assert.equal(denied, "http://127.0.0.1:5174/admin/ads/settings?ads=denied");
  });

  it("stores an encrypted refresh token after a successful callback", async () => {
    const store = createMemoryAdsGoogleStore();
    const started = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    const state = new URL(started.url).searchParams.get("state") ?? "";
    const url = await completeGoogleAdsOAuth(
      store,
      { code: "ok", state },
      fakeClient({ accessToken: "access-secret", refreshToken: "refresh-secret" }),
    );
    assert.equal(url, "http://127.0.0.1:5174/admin/ads/settings?ads=connected");
    const connection = await store.getConnection();
    assert.ok(connection);
    assert.doesNotMatch(connection.encrypted_tokens, /access-secret|refresh-secret/);
    const tokens = decryptAdsGoogleTokens(connection.encrypted_tokens);
    assert.equal(tokens.refreshToken, "refresh-secret");
  });

  it("preserves an existing refresh token when Google omits a new one", async () => {
    const store = createMemoryAdsGoogleStore();
    const first = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    await completeGoogleAdsOAuth(
      store,
      { code: "ok", state: new URL(first.url).searchParams.get("state") ?? "" },
      fakeClient({ accessToken: "access-1", refreshToken: "refresh-keep" }),
    );
    const second = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    await completeGoogleAdsOAuth(
      store,
      { code: "ok2", state: new URL(second.url).searchParams.get("state") ?? "" },
      fakeClient({ accessToken: "access-2", refreshToken: "" }),
    );
    const tokens = decryptAdsGoogleTokens((await store.getConnection())!.encrypted_tokens);
    assert.equal(tokens.refreshToken, "refresh-keep");
    assert.equal(tokens.accessToken, "access-2");
  });

  it("force-refreshes instead of reusing a still-valid callback access token", async () => {
    const store = createMemoryAdsGoogleStore();
    const started = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    await completeGoogleAdsOAuth(
      store,
      { code: "ok", state: new URL(started.url).searchParams.get("state") ?? "" },
      fakeClient({ accessToken: "access-callback", refreshToken: "refresh-secret" }),
    );
    const refreshed = await getValidAdsAccessToken(
      store,
      fakeClient({ accessToken: "unused", refreshToken: "refresh-secret" }),
      { forceRefresh: true },
    );
    assert.equal(refreshed.accessToken, "access-refreshed");
    assert.equal(refreshed.refreshToken, "refresh-secret");
  });

  it("does not clear a developer-token rejection when refreshing", async () => {
    const store = createMemoryAdsGoogleStore();
    const started = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    await completeGoogleAdsOAuth(
      store,
      { code: "ok", state: new URL(started.url).searchParams.get("state") ?? "" },
      fakeClient({ accessToken: "access-callback", refreshToken: "refresh-secret" }),
    );
    const current = await store.getConnection();
    assert.ok(current);
    await store.upsertConnection({ ...current, status: "developer_token_error", validated_at: null });
    await getValidAdsAccessToken(
      store,
      fakeClient({ accessToken: "unused", refreshToken: "refresh-secret" }),
      { forceRefresh: true },
    );
    const after = await store.getConnection();
    assert.equal(after?.status, "developer_token_error");
    assert.equal(after?.validated_at, null);
  });

  it("persists auth_error when refresh fails", async () => {
    const store = createMemoryAdsGoogleStore();
    const started = await startGoogleAdsOAuth(store, "11111111-1111-1111-1111-111111111111");
    await completeGoogleAdsOAuth(
      store,
      { code: "ok", state: new URL(started.url).searchParams.get("state") ?? "" },
      fakeClient({ accessToken: "access-callback", refreshToken: "refresh-secret" }),
    );
    const failingClient = {
      ...fakeClient({ accessToken: "unused", refreshToken: "refresh-secret" }),
      async refreshAccessToken() {
        throw Object.assign(new Error("Google Ads authorization expired"), { code: "GOOGLE_ADS_OAUTH_INVALID" });
      },
    };
    await assert.rejects(() => getValidAdsAccessToken(store, failingClient, { forceRefresh: true }));
    assert.equal((await store.getConnection())?.status, "auth_error");
  });
});
