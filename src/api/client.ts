// Small fetch wrapper: adds the auth token, parses JSON and turns Django REST
// Framework error bodies into readable messages.

const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const TOKEN_KEY = "slowpitch.token";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

let token: string | null = readStoredToken();
let onUnauthorized: (() => void) | null = null;

export function getToken(): string | null {
  return token;
}

export function setToken(value: string | null): void {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private mode); the in-memory token still works.
  }
}

/** Called when the server rejects our token, so the app can send the user to sign in. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

const FIELD_LABELS: Record<string, string> = {
  display_name: "Name",
  jersey_number: "Jersey number",
  opponent_name: "Opponent",
  scheduled_at: "Date and time",
  start_date: "Start date",
  end_date: "End date",
  team_score: "Our score",
  opponent_score: "Their score",
};

function collectMessages(value: unknown): string[] {
  if (value == null) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(collectMessages);
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectMessages);
  return [String(value)];
}

function describeError(status: number, data: unknown): string {
  if (typeof data === "string") return data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const parts: string[] = [];
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const messages = collectMessages(value);
      const label = FIELD_LABELS[key];
      parts.push(...messages.map((message) => (label ? `${label}: ${message}` : message)));
    }
    if (parts.length) return parts.join(" ");
  }
  const messages = collectMessages(data);
  if (messages.length) return messages.join(" ");
  if (status === 404) return "That page or item doesn't exist, or you don't have access to it.";
  if (status === 403) return "You don't have permission to do that.";
  if (status >= 500) return "The server hit an error. Try again in a moment.";
  return `Request failed (${status}).`;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, data: unknown) {
    super(describeError(status, data));
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(0, error instanceof Error ? error.message : String(error));
}

/**
 * Fire-and-forget request to the public health check. On a host that sleeps
 * when idle (Render's free tier) this starts the wake-up while the user is
 * still typing their password.
 */
export function wakeServer(): void {
  fetch(`${API_URL}/api/health/`, { cache: "no-store" }).catch(() => undefined);
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function send(method: Method, path: string, body: unknown, accept: string): Promise<Response> {
  const headers: Record<string, string> = { Accept: accept };
  // FormData (file uploads) sets its own multipart Content-Type.
  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Token ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (!response.ok) {
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      // Non-JSON error body; fall back to a message based on the status.
    }
    if (response.status === 401 && token) {
      setToken(null);
      onUnauthorized?.();
    }
    throw new ApiError(response.status, data);
  }
  return response;
}

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await send(method, path, body, "application/json");
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as T;
  }
}

export function query(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== false) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
  /** Download a file (such as an image) with the auth token attached. */
  blob: async (path: string) => (await send("GET", path, undefined, "*/*")).blob(),
};
