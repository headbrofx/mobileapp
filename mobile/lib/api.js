import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

// One place that knows how to talk to the Afya Nyumbani API.
//
// Tokens live in SecureStore rather than AsyncStorage: on Android that
// is the Keystore, so a refresh token — which is a key to somebody's
// health records — is not sitting in plain text on the device.
//
// The access token is short-lived by design. Rather than making every
// screen think about that, a 401 here refreshes once and replays the
// request. If the refresh also fails the session is genuinely over and
// onSessionLost is called, which is what sends the user back to the
// login screen.

const BASE_URL = Constants.expoConfig?.extra?.apiUrl ?? 'https://afya-nyumbani-api.onrender.com';

const ACCESS_KEY = 'afya.accessToken';
const REFRESH_KEY = 'afya.refreshToken';

let onSessionLost = () => {};

export function setSessionLostHandler(handler) {
  onSessionLost = handler;
}

export async function saveTokens({ accessToken, refreshToken }) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

// An error carrying what the API actually said, so a screen can show
// the server's message instead of "something went wrong".
export class ApiError extends Error {
  constructor(message, { status, code, errors } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

async function parse(response) {
  let body = null;
  try {
    body = await response.json();
  } catch {
    // A gateway timeout or a sleeping host can return HTML, and a JSON
    // parse failure should not surface as a confusing syntax error.
    throw new ApiError('The server did not respond properly. Try again.', {
      status: response.status,
    });
  }

  if (!response.ok || body?.success === false) {
    throw new ApiError(body?.message || 'Request failed', {
      status: response.status,
      code: body?.code,
      errors: body?.errors,
    });
  }

  return body?.data ?? null;
}

async function refreshSession() {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refreshToken) return false;

  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) return false;

  const body = await response.json();
  const tokens = body?.data?.tokens;
  if (!tokens?.accessToken) return false;

  await saveTokens(tokens);
  return true;
}

async function send(path, { method = 'GET', body, auth = true, retrying = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (auth) {
    const token = await SecureStore.getItemAsync(ACCESS_KEY);
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  // Refresh once, then replay. Retrying guards against a loop when the
  // refreshed token is itself rejected.
  if (response.status === 401 && auth && !retrying) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return send(path, { method, body, auth, retrying: true });
    }
    await clearTokens();
    onSessionLost();
  }

  return parse(response);
}

export const api = {
  get: (path) => send(path),
  post: (path, body, options) => send(path, { method: 'POST', body, ...options }),
  patch: (path, body) => send(path, { method: 'PATCH', body }),
  put: (path, body) => send(path, { method: 'PUT', body }),
  del: (path) => send(path, { method: 'DELETE' }),
};

// --- The calls the app actually makes ---

export const auth = {
  register: (payload) => send('/api/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (identifier, password) =>
    send('/api/auth/login', { method: 'POST', body: { identifier, password }, auth: false }),
  me: () => api.get('/api/auth/me'),
  logout: () => api.post('/api/auth/logout'),
};

export const familyMembers = {
  list: () => api.get('/api/family-members'),
};

export const bookings = {
  list: () => api.get('/api/bookings'),
  create: (payload) => api.post('/api/bookings', payload),
};

export const services = {
  // Where a booking's serviceId comes from.
  list: () => api.get('/api/services'),
};

export const afyaAi = {
  ask: (question, familyMemberId) =>
    api.post('/api/ai/ask', familyMemberId ? { question, familyMemberId } : { question }),
  history: () => api.get('/api/ai/history'),
};

export const health = {
  check: () => send('/api/health', { auth: false }),
};

export { BASE_URL };
