export function formatAnalyticsCount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return "Unavailable";
  }
  return new Intl.NumberFormat("en-CA").format(value);
}

export function formatAnalyticsDuration(seconds: number | null | undefined) {
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return "Unavailable";
  }
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (minutes <= 0) {
    return `${remainder}s`;
  }
  return `${minutes}m ${remainder}s`;
}

export function analyticsComparisonLabel(metric: {
  current: number;
  previous: number;
  deltaLabel: string;
} | null | undefined) {
  if (!metric) {
    return null;
  }
  if (metric.previous === 0) {
    return metric.current === 0 ? "No change from the previous period" : "No previous-period activity";
  }
  return metric.deltaLabel;
}

export function goatCounterConnectionLabel(input: { connected: boolean; reason?: string | null }) {
  return analyticsConnectionLabel(input);
}

export function analyticsConnectionLabel(input: { connected: boolean; reason?: string | null }) {
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
