// Thin fetch wrapper shared by all feature services.
// Every API response follows { success, message?, data? } — see docs/API.md.

const BASE_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;
const TOKEN_KEY = 'aurex26_token';

export const getToken = () => localStorage.getItem(TOKEN_KEY);
export const setToken = (token) =>
  token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

export async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const token = getToken();
  const isFormData = body instanceof FormData;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      ...(!isFormData && body !== undefined && { 'Content-Type': 'application/json' }),
      ...(token && { Authorization: `Bearer ${token}` }),
      ...headers,
    },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await res.json().catch(() => ({}));

  if (!res.ok || payload.success === false) {
    const error = new Error(payload.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.errors = payload.errors;
    throw error;
  }

  return payload;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
};

export const checkHealth = () => api.get('/health');
