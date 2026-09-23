// Thin fetch wrapper shared by all feature services.
// Every API response follows { success, message?, data?, errors? }; see docs/API.md.

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;
const TOKEN_KEY = 'aurex26_token';

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage unavailable (private mode): the session simply won't persist.
  }
}

export class ApiError extends Error {
  constructor(message, status, errors) {
    super(message);
    this.status = status; // 0 = network error
    this.errors = errors; // [{ field, message }] on validation failures
  }
}

const FALLBACK_MESSAGES = {
  401: 'Please sign in to continue.',
  403: "You don't have permission to do that.",
  404: "We couldn't find what you were looking for.",
  500: 'Something went wrong on our side. Please try again in a moment.',
};

// Builds "?a=1&b=2", skipping empty values.
export function toQuery(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const query = search.toString();
  return query ? `?${query}` : '';
}

async function send(path, { method = 'GET', body } = {}) {
  const token = getToken();
  try {
    return await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Could not reach the server. Check your connection and try again.', 0);
  }
}

async function toError(res) {
  const payload = await res.json().catch(() => null);
  const { status } = res;

  // Expired or revoked session: drop the token and let AuthContext react.
  if (status === 401 && getToken()) {
    setToken(null);
    window.dispatchEvent(new Event('auth:expired'));
  }

  const message = status >= 500 ? FALLBACK_MESSAGES[500] : payload?.message || FALLBACK_MESSAGES[status];
  return new ApiError(message || `Request failed (${status})`, status, payload?.errors);
}

// Returns the full envelope { success, message, data }.
export async function request(path, options) {
  const res = await send(path, options);
  if (!res.ok) throw await toError(res);
  return res.json();
}

// For non-JSON responses (PDF downloads). Returns a Blob.
export async function requestBlob(path) {
  const res = await send(path);
  if (!res.ok) throw await toError(res);
  return res.blob();
}

// Shorthands returning only `data`.
export const api = {
  get: async (path) => (await request(path)).data,
  post: async (path, body) => (await request(path, { method: 'POST', body })).data,
  put: async (path, body) => (await request(path, { method: 'PUT', body })).data,
  patch: async (path, body) => (await request(path, { method: 'PATCH', body })).data,
  delete: async (path) => (await request(path, { method: 'DELETE' })).data,
};
