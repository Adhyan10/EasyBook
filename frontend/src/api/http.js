const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:5000/api';
const NETWORK_ERROR = 'Cannot reach the server. Check your connection and try again.';
const TIMEOUT_ERROR = 'The server is taking too long to respond. Please try again in a moment.';
const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function request(path, { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const headers = {
    ...(body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // A request that never answers must end in an error the page can show, not an endless spinner.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    throw new ApiError(0, err?.name === 'AbortError' ? TIMEOUT_ERROR : NETWORK_ERROR);
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new ApiError(response.status, payload?.error ?? 'Request failed');
  }
  return payload.data;
}
