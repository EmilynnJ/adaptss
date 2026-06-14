import { config } from "./config.js";

// Token getter is injected by the Auth0 provider wrapper at runtime.
let tokenGetter: (() => Promise<string>) | null = null;
export function setTokenGetter(fn: () => Promise<string>) {
  tokenGetter = fn;
}

async function request<T>(path: string, opts: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as Record<string, string>) };
  if (auth && tokenGetter) {
    try {
      const token = await tokenGetter();
      headers.Authorization = `Bearer ${token}`;
    } catch {
      /* not logged in */
    }
  }
  const res = await fetch(`${config.apiBase}${path}`, { ...opts, headers });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(p: string, auth = false) => request<T>(p, { method: "GET" }, auth),
  post: <T>(p: string, body?: unknown, auth = true) =>
    request<T>(p, { method: "POST", body: body ? JSON.stringify(body) : undefined }, auth),
  patch: <T>(p: string, body?: unknown) =>
    request<T>(p, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }, true),
  del: <T>(p: string) => request<T>(p, { method: "DELETE" }, true),
};
