import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyGoogleAdsError, GOOGLE_ADS_API_VERSION } from "./googleAdsRestClient.js";

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
});
