import Constants from 'expo-constants';
import { deleteItem, getItem, setItem } from './storage';

// One place that knows how to talk to the Afya Nyumbani API.
//
// Where the tokens live is storage.js's problem: the Keystore on a
// phone, sessionStorage in a browser, because a browser has no
// keychain to offer. Everything below is the same either way.
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

// `remember` decides whether the refresh token is kept at all. Without
// it the session lasts as long as the short-lived access token and then
// ends — which is what somebody unticking "remember me" on a shared
// phone is actually asking for. Ticking it is the default, and the
// refresh token is what lets the app reopen without a login.
export async function saveTokens({ accessToken, refreshToken }, { remember = true } = {}) {
  await setItem(ACCESS_KEY, accessToken);
  if (remember && refreshToken) {
    await setItem(REFRESH_KEY, refreshToken);
  } else {
    await deleteItem(REFRESH_KEY);
  }
}

export async function clearTokens() {
  await deleteItem(ACCESS_KEY);
  await deleteItem(REFRESH_KEY);
}

export async function getAccessToken() {
  return getItem(ACCESS_KEY);
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
  const refreshToken = await getItem(REFRESH_KEY);
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
    const token = await getItem(ACCESS_KEY);
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
  // The endpoint is real and records the request, but nothing delivers
  // the token yet — there is no SMS or email gateway, so it reaches the
  // server log and no further. The screen says so rather than implying
  // a message is on its way.
  forgotPassword: (identifier) =>
    send('/api/auth/password/forgot', { method: 'POST', body: { identifier }, auth: false }),
};

export const clientProfile = {
  get: () => api.get('/api/client-profile'),
  update: (payload) => api.patch('/api/client-profile', payload),
};

export const healthProfile = {
  get: (memberId) => api.get(`/api/family-members/${memberId}/health-profile`),
  update: (memberId, payload) =>
    api.patch(`/api/family-members/${memberId}/health-profile`, payload),
};

export const familyMembers = {
  list: () => api.get('/api/family-members'),
  create: (payload) => api.post('/api/family-members', payload),
  update: (id, payload) => api.patch(`/api/family-members/${id}`, payload),
  // Health screens are about one person, and by default that person is
  // the account holder — the SELF member the backend creates on
  // registration. Falls back to the first one rather than failing, so a
  // screen still works if SELF was renamed.
  async self() {
    const data = await api.get('/api/family-members');
    const list = data?.familyMembers ?? [];
    return list.find((member) => member.relationship === 'SELF') ?? list[0] ?? null;
  },
};

export const symptoms = {
  catalogue: () => api.get('/api/symptom-catalogue'),
  list: (memberId) => api.get(`/api/family-members/${memberId}/symptoms`),
  report: (memberId, payload) => api.post(`/api/family-members/${memberId}/symptoms`, payload),
};

export const cycles = {
  list: (memberId) => api.get(`/api/family-members/${memberId}/cycles`),
  insights: (memberId) => api.get(`/api/family-members/${memberId}/cycles/insights`),
  log: (memberId, payload) => api.post(`/api/family-members/${memberId}/cycles`, payload),
};

export const medications = {
  list: (memberId) => api.get(`/api/family-members/${memberId}/medications`),
  due: (memberId) => api.get(`/api/family-members/${memberId}/medications/due?hours=48`),
  adherence: (memberId) => api.get(`/api/family-members/${memberId}/medications/adherence`),
  markDose: (memberId, doseId, status) =>
    api.post(`/api/family-members/${memberId}/medications/doses/${doseId}`, { status }),
};

export const notifications = {
  list: () => api.get('/api/notifications'),
  markRead: (id) => api.post(`/api/notifications/${id}/read`),
  markAllRead: () => api.post('/api/notifications/read-all'),
};

export const invoices = {
  list: () => api.get('/api/invoices'),
};

export const bookings = {
  list: () => api.get('/api/bookings'),
  create: (payload) => api.post('/api/bookings', payload),
  // The backend requires a reason and records who cancelled, so this is
  // never a silent disappearance.
  cancel: (id, reason) => api.patch(`/api/bookings/${id}/cancel`, { reason }),
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
