const API_URL = import.meta.env?.VITE_API_URL ?? 'http://localhost:5000/api';
const NETWORK_ERROR = 'Cannot reach the server. Check your connection and try again.';
const TIMEOUT_ERROR = 'The server is taking too long to respond. Please try again in a moment.';
const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_READ_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const PROXY_FAILURE_STATUSES = new Set([502, 503, 504]);

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A hosting proxy that cannot find the server answers 404/502/503/504 without the API's JSON envelope.
// The API itself always answers with JSON, so those failures are worth another try, for reads only.
const isProxyHiccup = (status, payload) => PROXY_FAILURE_STATUSES.has(status) || (status === 404 && !payload);

async function attempt(path, { method, body, token, timeoutMs }) {
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
    const error = new ApiError(0, err?.name === 'AbortError' ? TIMEOUT_ERROR : NETWORK_ERROR);
    error.retryable = err?.name !== 'AbortError';
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    const error = new ApiError(response.status, payload?.error ?? 'Request failed');
    error.retryable = isProxyHiccup(response.status, payload);
    throw error;
  }
  return payload.data;
}

export async function request(
  path,
  { method = 'GET', body, token, timeoutMs = DEFAULT_TIMEOUT_MS, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = {},
) {
  const maxRetries = method === 'GET' ? MAX_READ_RETRIES : 0;
  for (let tries = 0; ; tries += 1) {
    try {
      return await attempt(path, { method, body, token, timeoutMs });
    } catch (err) {
      if (!err.retryable || tries >= maxRetries) throw err;
      await sleep(retryDelayMs * (tries + 1));
    }
  }
}
