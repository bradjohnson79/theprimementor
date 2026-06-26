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

async function getErrorMessage(res: Response) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = await res.json().catch(() => null) as { message?: unknown; error?: unknown } | null;
    if (typeof body?.message === "string" && body.message.trim()) return body.message;
    if (typeof body?.error === "string" && body.error.trim()) return body.error;
  }
  return await res.text().catch(() => res.statusText) || res.statusText;
}

function downloadBlobResponse(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
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

  postForm: async (path: string, body: FormData, token?: string | null) => {
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), {
      method: "POST",
      headers,
      body,
    });
    return handleResponse(res);
  },

  patch: async (path: string, body?: unknown, token?: string | null) => {
    const hasBody = body !== undefined && body !== null;
    const headers: Record<string, string> = {};
    if (hasBody) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), {
      method: "PATCH",
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  put: async (path: string, body?: unknown, token?: string | null) => {
    const hasBody = body !== undefined && body !== null;
    const headers: Record<string, string> = {};
    if (hasBody) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), {
      method: "PUT",
      headers,
      body: hasBody ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  delete: async (path: string, token?: string | null, body?: unknown) => {
    const headers: Record<string, string> = {};
    if (body !== undefined && body !== null) headers["Content-Type"] = "application/json";
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(resolveApiUrl(path), {
      method: "DELETE",
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });
    return handleResponse(res);
  },

  /** Binary download (DOCX/PDF). Uses fetch blob; filename hint for save dialog. */
  downloadBlob: async (path: string, token: string | null, suggestedFilename: string) => {
    const res = await fetch(resolveApiUrl(path), {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new Error(await getErrorMessage(res));
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    let filename = suggestedFilename;
    const m = cd?.match(/filename="?([^";]+)"?/);
    if (m?.[1]) filename = m[1];
    downloadBlobResponse(blob, filename);
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
      throw new Error(await getErrorMessage(res));
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    let filename = suggestedFilename;
    const m = cd?.match(/filename="?([^";]+)"?/);
    if (m?.[1]) filename = m[1];
    downloadBlobResponse(blob, filename);
  },
};
