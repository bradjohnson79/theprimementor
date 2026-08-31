import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encryptAdsGoogleTokens } from "./adsTokenCrypto.js";
import { hasMutationAdsTool, maskCustomerId, serializeGoogleAdsStatus } from "./googleAdsConnectionService.js";
import { createDisconnectedGoogleAdsProvider } from "./googleAdsProvider.js";
import { createMemoryAdsGoogleStore } from "./googleAdsStore.js";
import { invokeAdsAgentTool } from "./adsAgentTools.js";

describe("Google Ads connection status", () => {
  it("stays DISCONNECTED without a validated refresh token and never returns secret keys", async () => {
    const previous = {
      token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      customer: process.env.GOOGLE_ADS_CUSTOMER_ID,
      login: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      client: process.env.GOOGLE_ADS_CLIENT_ID,
      key: process.env.ADS_TOKEN_ENCRYPTION_KEY,
    };
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "secret-token";
    process.env.GOOGLE_ADS_CLIENT_ID = "client-id";
    process.env.GOOGLE_ADS_CLIENT_SECRET = "client-secret";
    process.env.GOOGLE_ADS_CUSTOMER_ID = "4058459597";
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "8604690994";
    process.env.ADS_TOKEN_ENCRYPTION_KEY = "c".repeat(64);
    try {
      const status = await serializeGoogleAdsStatus(createMemoryAdsGoogleStore());
      assert.equal(status.mode, "DISCONNECTED");
      assert.equal(status.connectionStatus, "oauth_required");
      assert.equal(status.configured, false);
      assert.equal(status.authenticated, false);
      assert.equal(status.hasDeveloperToken, true);
      assert.equal(status.oauthClientConfigured, true);
      assert.equal(status.customerIdDisplay, "405-845-9597");
      assert.equal(status.loginCustomerIdDisplay, "860-469-0994");
      const json = JSON.stringify(status);
      assert.equal(json.includes("secret-token"), false);
      assert.equal(json.includes("client-secret"), false);
      assert.equal(json.includes("clientSecret"), false);
      assert.equal(json.includes("refreshToken"), false);
    } finally {
      process.env.GOOGLE_ADS_DEVELOPER_TOKEN = previous.token;
      process.env.GOOGLE_ADS_CLIENT_SECRET = previous.secret;
      process.env.GOOGLE_ADS_CUSTOMER_ID = previous.customer;
      process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = previous.login;
      process.env.GOOGLE_ADS_CLIENT_ID = previous.client;
      process.env.ADS_TOKEN_ENCRYPTION_KEY = previous.key;
    }
  });

  it("becomes READ_ONLY only after a validated encrypted connection", async () => {
    const previousKey = process.env.ADS_TOKEN_ENCRYPTION_KEY;
    process.env.ADS_TOKEN_ENCRYPTION_KEY = "c".repeat(64);
    try {
      const store = createMemoryAdsGoogleStore();
      await store.upsertConnection({
        encrypted_tokens: encryptAdsGoogleTokens({
          accessToken: "access-secret",
          refreshToken: "refresh-secret",
        }),
        granted_scope: "https://www.googleapis.com/auth/adwords",
        status: "connected",
        validated_at: new Date(),
      });
      const status = await serializeGoogleAdsStatus(store);
      assert.equal(status.mode, "READ_ONLY");
      assert.equal(status.connectionStatus, "connected_read_only");
      assert.equal(status.authorizationConnected, true);
      assert.doesNotMatch(JSON.stringify(status), /refresh-secret|access-secret/);
    } finally {
      if (previousKey === undefined) delete process.env.ADS_TOKEN_ENCRYPTION_KEY;
      else process.env.ADS_TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });

  it("surfaces a developer-token rejection without becoming READ_ONLY", async () => {
    const previousKey = process.env.ADS_TOKEN_ENCRYPTION_KEY;
    process.env.ADS_TOKEN_ENCRYPTION_KEY = "c".repeat(64);
    try {
      const store = createMemoryAdsGoogleStore();
      await store.upsertConnection({
        encrypted_tokens: encryptAdsGoogleTokens({
          accessToken: "access-secret",
          refreshToken: "refresh-secret",
        }),
        granted_scope: "https://www.googleapis.com/auth/adwords",
        status: "developer_token_error",
        validated_at: null,
      });
      const status = await serializeGoogleAdsStatus(store);
      assert.equal(status.mode, "DISCONNECTED");
      assert.equal(status.authorizationConnected, true);
      assert.equal(status.apiAccessValidated, false);
      assert.equal(status.connectionStatus, "developer_token_error");
      assert.match(status.lastError ?? "", /developer token is only approved for use with test accounts/i);
      assert.doesNotMatch(JSON.stringify(status), /refresh-secret|access-secret/);
    } finally {
      if (previousKey === undefined) delete process.env.ADS_TOKEN_ENCRYPTION_KEY;
      else process.env.ADS_TOKEN_ENCRYPTION_KEY = previousKey;
    }
  });

  it("masks customer ids", () => {
    assert.equal(maskCustomerId("123-456-7890"), "123-***-7890");
    assert.equal(maskCustomerId(""), null);
  });

  it("keeps reporting tools disconnected without a store", async () => {
    assert.equal(await createDisconnectedGoogleAdsProvider().connection.getMode(), "DISCONNECTED");
    const summary = await invokeAdsAgentTool("getAccountSummary");
    assert.equal("available" in summary && summary.available, false);
    if ("reason" in summary) assert.equal(summary.reason, "DISCONNECTED");
  });

  it("rejects mutation tool names", async () => {
    assert.equal(hasMutationAdsTool("pauseCampaign"), true);
    assert.equal(hasMutationAdsTool("getCampaignPerformance"), false);
    const blocked = await invokeAdsAgentTool("pauseCampaign");
    assert.equal("available" in blocked && blocked.available, false);
  });
});
