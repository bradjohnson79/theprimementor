export function readTwilioConfig(env: Record<string, string | undefined>) {
  const accountSid = env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const apiKeySid = env.TWILIO_API_KEY_SID?.trim() ?? "";
  const apiKeySecret = env.TWILIO_API_KEY_SECRET?.trim() ?? "";
  const fromNumber = env.TWILIO_FROM_NUMBER?.trim() ?? "";
  if (!accountSid && !apiKeySid && !apiKeySecret && !fromNumber) {
    return { enabled: false as const };
  }
  if (!accountSid.startsWith("AC")) {
    throw new Error("TWILIO_ACCOUNT_SID must start with AC");
  }
  if (!apiKeySid.startsWith("SK")) {
    throw new Error("TWILIO_API_KEY_SID must start with SK");
  }
  if (!apiKeySecret || !fromNumber) {
    throw new Error("Twilio API key secret and from number are required");
  }
  return { enabled: true as const };
}
