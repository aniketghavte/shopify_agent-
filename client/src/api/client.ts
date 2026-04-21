import type { ChatResponse, HealthResponse } from "../types";

// In dev, Vite proxies /api/* to the backend. In prod you can set
// VITE_API_BASE_URL to an absolute URL instead.
const BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  ) ?? "/api";

interface RequestOptions {
  signal?: AbortSignal;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
    signal: options.signal,
  });

  if (!res.ok) {
    // FastAPI error shape: { detail: { error, detail } } or { detail: string }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* ignore */
    }
    const detail = extractErrorMessage(body) ?? res.statusText;
    const err = new Error(detail) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

function extractErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const d = b.detail;
  if (typeof d === "string") return d;
  if (d && typeof d === "object") {
    const dd = d as Record<string, unknown>;
    const err = dd.error ?? dd.detail;
    if (typeof err === "string") return err;
  }
  if (typeof b.error === "string") return b.error;
  return null;
}

export const api = {
  health: (options?: RequestOptions) =>
    request<HealthResponse>("/health", { method: "GET" }, options),

  chat: (
    payload: { message: string; session_id?: string; store_url?: string },
    options?: RequestOptions,
  ) =>
    request<ChatResponse>(
      "/chat",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      options,
    ),

  reset: (session_id: string, options?: RequestOptions) =>
    request<{ ok: boolean }>(
      "/chat/reset",
      {
        method: "POST",
        body: JSON.stringify({ session_id }),
      },
      options,
    ),
};
