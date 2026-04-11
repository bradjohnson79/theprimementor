const API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || "";

let warnedMissingApiBase = false;

export function resolveApiUrl(path: string) {
  if (import.meta.env.DEV && !API_BASE_URL && !warnedMissingApiBase) {
    warnedMissingApiBase = true;
    console.warn("[api] VITE_API_URL is not set; falling back to relative API paths.");
  }

  return `${API_BASE_URL}${path}`;
}
