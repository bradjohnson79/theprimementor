export const GOOGLE_ADS_SCOPE = "https://www.googleapis.com/auth/adwords";
export const ADS_GOOGLE_ACCOUNT_KEY = "prime_mentor";

export function digitsOnly(value: string | undefined | null) {
  return value?.replace(/[^\d]/g, "") ?? "";
}

export function configuredCustomerId() {
  return digitsOnly(process.env.GOOGLE_ADS_CUSTOMER_ID);
}

export function configuredLoginCustomerId() {
  return digitsOnly(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
}

export function displayCustomerId(value: string | undefined | null) {
  const raw = digitsOnly(value);
  if (raw.length !== 10) return raw || null;
  return `${raw.slice(0, 3)}-${raw.slice(3, 6)}-${raw.slice(6)}`;
}

export function maskCustomerId(value: string | undefined | null) {
  const raw = digitsOnly(value);
  if (!raw) return null;
  if (raw.length < 6) return "***";
  return `${raw.slice(0, 3)}-***-${raw.slice(-4)}`;
}
