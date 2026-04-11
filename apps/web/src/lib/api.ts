import { resolveApiUrl } from "./apiBase";

async function handleResponse(res: Response) {
  if (!res.ok) {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = (await res.json().catch(() => null)) as {
        error?: unknown;
        code?: unknown;
        message?: unknown;
      } | null;
      const message = typeof body?.message === "string" && body.message.trim()
        ? body.message
        : typeof body?.error === "string" && body.error.trim()
          ? body.error
          : res.statusText;
      const error = new Error(message || res.statusText) as Error & { status?: number; code?: string };
      error.status = res.status;
      if (typeof body?.code === "string" && body.code.trim()) {
        error.code = body.code;
      }
      throw error;
    }
    const body = await res.text().catch(() => res.statusText);
    const error = new Error(body || res.statusText) as Error & { status?: number; code?: string };
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export const api = {
  get: async (path: string, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), { headers });
    return handleResponse(res);
  },

  post: async (path: string, body?: unknown, token?: string | null) => {
    const hasBody = body !== undefined && body !== null;
    const headers: Record<string, string> = {};
    if (hasBody) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), {
      method: "POST",
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  delete: async (path: string, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), { method: "DELETE", headers });
    return handleResponse(res);
  },

  downloadBlobPost: async (
    path: string,
    body: unknown,
    token: string | null,
    suggestedFilename: string,
  ) => {
    const res = await fetch(resolveApiUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const bodyText = await res.text().catch(() => res.statusText);
      throw new Error(bodyText || res.statusText);
    }
    const blob = await res.blob();
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename = suggestedFilename;
    const match = contentDisposition?.match(/filename="?([^";]+)"?/);
    if (match?.[1]) {
      filename = match[1];
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  },
};
