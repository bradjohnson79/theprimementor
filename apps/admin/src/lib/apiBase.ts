const RAW_API_BASE_URL = import.meta.env.VITE_API_URL?.trim() || "";

let warnedMissingApiBase = false;

function normalizeApiBaseUrl(value: string) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    if (!url.pathname || url.pathname === "/") {
      url.pathname = "/api";
    }
    return url.toString().replace(/\/+$/, "");
  } catch {
    if (trimmed === "/") {
      return "/api";
    }
    return trimmed;
  }
}

const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

export function resolveApiUrl(path: string) {
  if (import.meta.env.DEV && !API_BASE_URL && !warnedMissingApiBase) {
    warnedMissingApiBase = true;
    console.warn("[api] VITE_API_URL is not set; falling back to relative API paths.");
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return API_BASE_URL ? `${API_BASE_URL}${normalizedPath}` : normalizedPath;
}
