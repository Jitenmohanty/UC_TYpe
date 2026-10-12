export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: "SUPER_ADMIN" | "TENANT_ADMIN" | "EMPLOYEE";
  permissions: string[];
  modules?: string[];
  tenant?: { id: string; name: string; slug: string } | null;
};

let accessToken: string | null = null;
let csrfToken: string | null = null;
const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/$/, "");

function cookie(name: string) {
  if (typeof document === "undefined") return null;
  const pair = document.cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : null;
}

export function setSession(token: string | null, csrf: string | null = null) {
  accessToken = token;
  csrfToken = csrf ?? cookie("routewise_csrf");
}

export function clearSession() {
  accessToken = null;
  csrfToken = null;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) headers.set("content-type", "application/json");
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${apiBase}${path}`, { ...init, headers, credentials: "include" });
  if (response.status === 401 && retry && path !== "/auth/refresh" && path !== "/auth/login" && path !== "/auth/platform-login") {
    const refreshed = await refreshSession();
    if (refreshed) return request<T>(path, init, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed (${response.status}).`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" })
};

async function refreshSession() {
  csrfToken = cookie("routewise_csrf") ?? csrfToken;
  if (!csrfToken) return false;
  const response = await fetch(`${apiBase}/auth/refresh`, {
    method: "POST", credentials: "include", headers: { "x-csrf-token": csrfToken }
  });
  if (!response.ok) return false;
  const payload = await response.json() as { accessToken: string };
  accessToken = payload.accessToken;
  return true;
}

export async function restoreSession() {
  if (!await refreshSession()) return null;
  return api.get<ApiUser>("/auth/me");
}

export async function login(input: { email: string; password: string; tenantSlug?: string; platform?: boolean }) {
  const path = input.platform ? "/auth/platform-login" : "/auth/login";
  const payload = await request<{ accessToken: string; csrfToken: string; user: ApiUser }>(path, {
    method: "POST", body: JSON.stringify({ email: input.email, password: input.password, ...(input.tenantSlug ? { tenantSlug: input.tenantSlug } : {}) })
  }, false);
  setSession(payload.accessToken, payload.csrfToken);
  return payload.user;
}

export async function logout() {
  try {
    await request<void>("/auth/logout", { method: "POST", headers: { "x-csrf-token": cookie("routewise_csrf") ?? csrfToken ?? "" } }, false);
  } finally {
    clearSession();
  }
}
