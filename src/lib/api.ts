import type { ApiErrorBody, JsonRecord, Session } from "../types/api";

const API_URL = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/$/, "");
const SESSION_KEY = "warungkasir.session";
const REQUEST_TIMEOUT_MS = 30_000;

export type ApiPageMeta = {
  page: number;
  limit: number;
  has_more: boolean;
};

export type ApiPage<T> = {
  items: T[];
  meta: ApiPageMeta;
};

const snakeKey = (key: string) =>
  key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();

const uuidFromBytes = (value: unknown): string | null => {
  let bytes: number[] | null = null;

  if (Array.isArray(value)) {
    bytes = value;
  } else if (value && typeof value === "object") {
    const candidate = value as Record<string, unknown>;
    const candidateBytes = candidate.bytes ?? candidate.Bytes;
    const candidateValid = candidate.valid ?? candidate.Valid;
    if (candidateValid !== false && Array.isArray(candidateBytes)) {
      bytes = candidateBytes;
    }
  } else if (typeof value === "string" && value.includes(",")) {
    bytes = value.split(",").map((item) => Number(item.trim()));
  }

  if (
    !bytes ||
    bytes.length !== 16 ||
    bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)
  ) {
    return null;
  }

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const normalize = (value: any, parentKey = ""): any => {
  const normalizedKey = snakeKey(parentKey);
  const isIdentifier = normalizedKey === "id" || normalizedKey.endsWith("_id");
  if (isIdentifier) {
    const uuid = uuidFromBytes(value);
    if (uuid) return uuid;
  }

  if (Array.isArray(value)) return value.map((item) => normalize(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        const normalizedChildKey = snakeKey(key);
        return [normalizedChildKey, normalize(item, normalizedChildKey)];
      }),
    );
  }
  return value;
};

export class ApiError extends Error {
  status: number;
  code: string;
  fields?: Record<string, string>;

  constructor(status: number, body?: ApiErrorBody) {
    const fieldMessages = body?.fields
      ? [...new Set(Object.values(body.fields).filter(Boolean))]
      : [];
    super(
      fieldMessages.length
        ? fieldMessages.join("; ")
        : body?.message || "Layanan belum dapat dihubungi",
    );
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
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort("timeout"),
      REQUEST_TIMEOUT_MS,
    );
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
      signal: controller.signal,
    }).finally(() => window.clearTimeout(timeout));
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

type ApiEnvelope<T> = { data: T; meta?: ApiPageMeta };

async function requestEnvelope<T = JsonRecord>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<ApiEnvelope<T>> {
  const session = sessionStore.get();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  if (session?.access_token)
    headers.set("Authorization", `Bearer ${session.access_token}`);
  headers.set("Accept", "application/json");

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort("timeout"), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort(options.signal?.reason);
  if (options.signal) {
    if (options.signal.aborted) abortFromCaller();
    else options.signal.addEventListener("abort", abortFromCaller, { once: true });
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted) {
      if (options.signal?.aborted) throw error;
      throw new Error(
        "Permintaan terlalu lama. Periksa koneksi jaringan lalu coba kembali.",
      );
    }
    throw new Error(
      "Layanan belum dapat dihubungi. Pastikan server berjalan dan jaringan tersedia.",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }

  if (response.status === 401 && retry && session?.refresh_token) {
    refreshPromise ||= refreshSession().finally(() => {
      refreshPromise = null;
    });
    if (await refreshPromise) return requestEnvelope<T>(path, options, false);
  }
  if (response.status === 204) return { data: undefined as T };
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const payload = contentType.includes("json")
      ? normalize(await response.json())
      : undefined;
    throw new ApiError(response.status, payload?.error);
  }
  if (!contentType.includes("json")) {
    return { data: (await response.blob()) as T };
  }
  const payload = normalize(await response.json());
  return {
    data: payload.data as T,
    meta: payload.meta as ApiPageMeta | undefined,
  };
}

export async function api<T = JsonRecord>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  return (await requestEnvelope<T>(path, options)).data;
}

export async function apiPage<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiPage<T>> {
  const payload = await requestEnvelope<T[]>(path, options);
  return {
    items: Array.isArray(payload.data) ? payload.data : [],
    meta: payload.meta || { page: 1, limit: 50, has_more: false },
  };
}

export async function fetchAllPages<T>(
  path: string,
  options: { pageSize?: number; maxItems?: number; signal?: AbortSignal } = {},
): Promise<T[]> {
  const pageSize = Math.min(Math.max(options.pageSize || 100, 1), 100);
  const maxItems = Math.max(options.maxItems || 20_000, pageSize);
  const separator = path.includes("?") ? "&" : "?";
  const items: T[] = [];
  let page = 1;
  let hasMore = false;

  while (items.length < maxItems) {
    const result = await apiPage<T>(
      `${path}${separator}page=${page}&limit=${pageSize}`,
      { signal: options.signal },
    );
    items.push(...result.items);
    hasMore = result.meta.has_more;
    if (!hasMore || result.items.length === 0) break;
    page += 1;
  }

  if (hasMore && items.length >= maxItems) {
    throw new Error(
      "Jumlah data terlalu besar untuk dimuat sekaligus. Gunakan pencarian atau filter yang lebih spesifik.",
    );
  }
  return items.slice(0, maxItems);
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

export const requireActiveShiftID = async (): Promise<string> => {
  const shiftId = await activeShiftID();
  if (!shiftId) {
    throw new Error(
      "Transaksi tunai wajib memakai sif aktif. Buka sif terlebih dahulu di menu Kas & Sif.",
    );
  }
  return shiftId;
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
