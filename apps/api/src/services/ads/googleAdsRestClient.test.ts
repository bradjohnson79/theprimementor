import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyGoogleAdsError, GOOGLE_ADS_API_VERSION, searchGoogleAds } from "./googleAdsRestClient.js";

describe("Google Ads REST client", () => {
  it("uses a current Ads API version", () => {
    assert.equal(GOOGLE_ADS_API_VERSION, "v25");
  });

  it("classifies a test-only developer token with the Google message", () => {
    const error = classifyGoogleAdsError(403, {
      error: {
        message: "The caller does not have permission",
        details: [{
          errors: [{
            message: "The developer token is only approved for use with test accounts. To access non-test accounts, apply for Basic or Standard access.",
            errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" },
          }],
        }],
      },
    });
    assert.equal((error as Error & { code?: string }).code, "GOOGLE_ADS_DEVELOPER_TOKEN_ERROR");
    assert.match(error.message, /developer token is only approved for use with test accounts/i);
  });

  it("retries a client-account search without the manager header when the MCC link is missing", async () => {
    const previous = {
      GOOGLE_ADS_CUSTOMER_ID: process.env.GOOGLE_ADS_CUSTOMER_ID,
      GOOGLE_ADS_LOGIN_CUSTOMER_ID: process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID,
      GOOGLE_ADS_DEVELOPER_TOKEN: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    };
    process.env.GOOGLE_ADS_CUSTOMER_ID = "4058459597";
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = "8604690994";
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = "test-token";
    const logins: string[] = [];
    const fetcher = (async (_url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      logins.push(headers.get("login-customer-id") || "");
      if (logins.length === 1) {
        return new Response(JSON.stringify({
          error: { message: "The caller does not have permission" },
        }), { status: 403 });
      }
      return new Response(JSON.stringify({
        results: [{ customer: { id: "4058459597", descriptiveName: "Prime Mentor Ads" } }],
      }), { status: 200 });
    }) as typeof fetch;
    try {
      const rows = await searchGoogleAds({
        accessToken: "ya29.test",
        query: "SELECT customer.id FROM customer LIMIT 1",
        fetcher,
      });
      assert.deepEqual(logins, ["8604690994", "4058459597"]);
      assert.equal((rows[0]?.customer as { id?: string })?.id, "4058459597");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
