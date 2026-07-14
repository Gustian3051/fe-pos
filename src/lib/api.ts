import type { ApiErrorBody, JsonRecord, Session } from "../types/api";

const API_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const SESSION_KEY = "warungkasir.session";

const snakeKey = (key: string) =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();

const normalize = (value: any): any => {
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        snakeKey(key),
        normalize(item),
      ]),
    );
  }
  return value;
};

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, body?: ApiErrorBody) {
    super(body?.message || "Layanan belum dapat dihubungi");
    this.name = "ApiError";
    this.status = status;
    this.code = body?.code || "request_failed";
    this.fields = body?.fields;
  }
}

export const sessionStore = {
  get: (): Session | null => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch {
      return null;
    }
  },
  set: (session: Session) =>
    localStorage.setItem(SESSION_KEY, JSON.stringify(session)),
  clear: () => localStorage.removeItem(SESSION_KEY),
};

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession() {
  const session = sessionStore.get();
  if (!session?.refresh_token) return false;
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    if (!response.ok) throw new Error("refresh failed");
    const payload = normalize(await response.json());
    sessionStore.set(payload.data);
    return true;
  } catch {
    sessionStore.clear();
    window.dispatchEvent(new Event("warungkasir:unauthorized"));
    return false;
  }
}

export async function api<T = JsonRecord>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const session = sessionStore.get();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (session?.access_token)
    headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (response.status === 401 && retry && session?.refresh_token) {
    refreshPromise ||= refreshSession().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) return api<T>(path, options, false);
  }
  if (response.status === 204) return undefined as T;
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const payload = contentType.includes("json")
      ? normalize(await response.json())
      : undefined;
    throw new ApiError(response.status, payload?.error);
  }
  if (!contentType.includes("json")) return (await response.blob()) as T;
  const payload = normalize(await response.json());
  return payload.data as T;
}

export const json = (
  method: string,
  body?: unknown,
  headers?: HeadersInit,
): RequestInit => ({
  method,
  headers,
  body: body === undefined ? undefined : JSON.stringify(body),
});

export const downloadReport = async (
  kind: string,
  from: string,
  to: string,
) => {
  const blob = await api<Blob>(
    `/reports/export/${kind}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${kind}-report.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const activeShiftID = async (): Promise<string | null> => {
  try {
    const shift = await api<{ id: string }>("/shifts/current");
    return shift.id;
  } catch {
    return null;
  }
};

export const newUUID = () => {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${value.slice(0, 4).join("")}-${value.slice(4, 6).join("")}-${value.slice(6, 8).join("")}-${value.slice(8, 10).join("")}-${value.slice(10).join("")}`;
};
