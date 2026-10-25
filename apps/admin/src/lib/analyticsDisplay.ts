export function formatAnalyticsCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-CA").format(value);
}

export function goatCounterConnectionLabel(input: { connected: boolean; reason?: string | null }) {
  if (input.connected) {
    return "Connected";
  }
  if (input.reason === "unauthorized" || input.reason === "forbidden") {
    return "Authentication failed";
  }
  if (input.reason === "unconfigured") {
    return "Not configured";
  }
  return "Unavailable";
}
