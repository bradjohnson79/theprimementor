import test from "node:test";
import assert from "node:assert/strict";
import { readTwilioConfig } from "./twilioEnv.js";

test("blank Twilio settings stay disabled", () => {
  assert.deepEqual(readTwilioConfig({}), { enabled: false });
});

test("an API key id is rejected as the account SID", () => {
  assert.throws(
    () => readTwilioConfig({
      TWILIO_ACCOUNT_SID: "SK00000000000000000000000000000000",
      TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
      TWILIO_API_KEY_SECRET: "secret",
      TWILIO_FROM_NUMBER: "+16045550100",
    }),
    /TWILIO_ACCOUNT_SID must start with AC/,
  );
});

test("a matching account and API key prefix is accepted", () => {
  const config = readTwilioConfig({
    TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
    TWILIO_API_KEY_SID: "SK00000000000000000000000000000000",
    TWILIO_API_KEY_SECRET: "secret",
    TWILIO_FROM_NUMBER: "+16045550100",
  });
  assert.equal(config.enabled, true);
});
