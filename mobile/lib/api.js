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
  // The access token stays with the tab whatever happens. It lasts
  // fifteen minutes, so persisting it buys nothing and costs a
  // credential sitting on disk.
  await setItem(ACCESS_KEY, accessToken);

  if (remember && refreshToken) {
    // This is the one that outlives the tab, and the only reason the
    // app can reopen without a login. It is also the one that can be
    // revoked from the server, which is what makes it the right thing
    // to persist rather than the access token.
    await setItem(REFRESH_KEY, refreshToken, { persist: true });
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

// Exported because the session provider needs it at launch, not only
// when a request comes back 401. On web the access token dies with the
// tab while the refresh token may not, and without this the app would
// find no access token, stop, and show a login screen to somebody who
// had asked to be remembered.
//
// One refresh at a time, shared by everybody who asks.
//
// Refresh tokens are single-use: the server rotates them, so the first
// request with a given token gets a new pair and the second gets a
// 401. That turns any two refreshes in flight together into a race
// with a guaranteed loser — and this app starts them together all the
// time. The Orbit dashboard fires four requests in one Promise.all;
// when the access token expires all four come back 401 at once, all
// four refresh with the same token, three of them lose, and each loser
// used to call clearTokens() and sign her out. React also mounts the
// session provider twice in development, which races the same way at
// launch.
//
// So the first caller starts the refresh and everyone else who arrives
// before it finishes is handed the same promise. One request, one
// rotation, nobody loses.
let refreshInFlight = null;

export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = refreshOnce().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function refreshOnce() {
  const refreshToken = await getItem(REFRESH_KEY);
  if (!refreshToken) return false;

  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    // The server has refused this token — expired, or revoked from
    // another device. Keeping it would mean every launch tries it
    // again and fails again, for as long as the browser keeps the
    // disk. Only an explicit refusal clears it; a 5xx is the server
    // having a bad moment, not a verdict on the token.
    if (response.status === 401 || response.status === 403) {
      await deleteItem(REFRESH_KEY);
    }
    return false;
  }

  const body = await response.json();
  const tokens = body?.data?.tokens;
  if (!tokens?.accessToken) return false;

  await saveTokens(tokens);
  return true;
}

async function send(path, { method = 'GET', body, auth = true, retrying = false, headers: extra } = {}) {
  const headers = { 'Content-Type': 'application/json', ...(extra || {}) };

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
      return send(path, { method, body, auth, retrying: true, headers: extra });
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
  // phone is only sent on the second call, after the API has answered
  // 409 PHONE_REQUIRED for a Google account it has never seen.
  google: (idToken, phone) =>
    send('/api/auth/google', {
      method: 'POST',
      body: phone ? { idToken, phone } : { idToken },
      auth: false,
    }),
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

// Orbit: the daily check-in, and what the recorded days add up to.
//
// Each of these returns its own status — NO_DATA, INSUFFICIENT_DATA or
// OBSERVED — rather than an empty object the screen has to guess about.
// The screen renders the status, not the absence of data.
export const orbit = {
  today: (memberId) => api.get(`/api/family-members/${memberId}/orbit/checkins/today`),
  checkins: (memberId) => api.get(`/api/family-members/${memberId}/orbit/checkins`),
  saveCheckin: (memberId, payload) =>
    api.post(`/api/family-members/${memberId}/orbit/checkins`, payload),
  patterns: (memberId) => api.get(`/api/family-members/${memberId}/orbit/patterns`),
  insight: (memberId) => api.get(`/api/family-members/${memberId}/orbit/insight`),
  report: (memberId, params) =>
    api.get(
      `/api/family-members/${memberId}/orbit/report` +
        (params?.year ? `?year=${params.year}&month=${params.month}` : '')
    ),

  // Privacy Centre.
  privacy: (memberId) => api.get(`/api/family-members/${memberId}/orbit/privacy`),
  forget: (memberId, scope) =>
    api.post(`/api/family-members/${memberId}/orbit/privacy/forget`, { scope }),
  // The export answers with the rows themselves rather than this API's
  // usual envelope, and as an attachment. So it cannot go through
  // send() — that would unwrap a `data` key which is not there — and it
  // cannot be a plain link either, because a link carries no
  // Authorization header and the server would refuse it.
  //
  // Fetched with the token and handed back as text. What happens to it
  // next is the screen's business: a file on web, a share sheet on a
  // phone.
  async exportRaw(memberId) {
    const token = await getItem(ACCESS_KEY);
    const res = await fetch(
      `${BASE_URL}/api/family-members/${memberId}/orbit/privacy/export`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    );
    if (!res.ok) throw new Error('Imeshindwa kuchukua nakala');
    return res.text();
  },
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

// A key that makes a create safe to send twice. Made once per form,
// so a double tap or a retry after a timeout returns the request the
// first attempt made instead of a second one.
export function newIdempotencyKey() {
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `app-${Date.now().toString(36)}-${rand()}${rand()}`;
}

export const bookings = {
  list: () => api.get('/api/bookings'),
  create: (payload, idempotencyKey) =>
    send('/api/bookings', {
      method: 'POST',
      body: payload,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  // The backend requires a reason and records who cancelled, so this is
  // never a silent disappearance.
  cancel: (id, reason) => api.patch(`/api/bookings/${id}/cancel`, { reason }),

  // Staff side of a visit.
  mySchedule: () => api.get('/api/staff/me/schedule'),
  act: (id, action, body) => api.patch(`/api/bookings/${id}/${action}`, body ?? {}),
  sharePosition: (id, lat, lng) => api.post(`/api/bookings/${id}/location`, { lat, lng }),
};

// Care Mobility: discovery, My Care Requests, tracking, saved places.
export const care = {
  discover: (coords) =>
    api.get(`/api/care/discover${coords ? `?lat=${coords.lat}&lng=${coords.lng}` : ''}`),
  requests: (tab) => api.get(`/api/care/requests?tab=${tab}`),
  // kind: 'home-visit' | 'transport'
  track: (kind, id) => api.get(`/api/care/requests/${kind}/${id}`),
  locations: () => api.get('/api/care/locations'),
  saveLocation: (payload) => api.post('/api/care/locations', payload),
  deleteLocation: (id) => api.del(`/api/care/locations/${id}`),
  setAvailability: (payload) => api.patch('/api/care/staff/availability', payload),
  myStaffProfile: () => api.get('/api/staff/me'),
};

export const transport = {
  create: (payload, idempotencyKey) =>
    send('/api/transport', {
      method: 'POST',
      body: payload,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    }),
  list: () => api.get('/api/transport'),
  get: (id) => api.get(`/api/transport/${id}`),
  acceptQuote: (id) => api.patch(`/api/transport/${id}/accept-quote`),
  declineQuote: (id, reason) => api.patch(`/api/transport/${id}/decline-quote`, reason ? { reason } : {}),
  cancel: (id, reason) => api.patch(`/api/transport/${id}/cancel`, { reason }),
  progress: (id, action) => api.patch(`/api/transport/${id}/progress`, { action }),
};

// The Dispatch Center. Every one of these is ADMIN-only on the server;
// the app hides the screens from everyone else, but the server is what
// actually says no.
export const dispatch = {
  queue: (view, kind) => api.get(`/api/dispatch/queue?view=${view}${kind ? `&kind=${kind}` : ''}`),
  booking: (id) => api.get(`/api/dispatch/bookings/${id}`),
  assignBooking: (id, staffId, overrideReason) =>
    api.post(`/api/dispatch/bookings/${id}/assign`, overrideReason ? { staffId, overrideReason } : { staffId }),
  reviewBooking: (id) => api.patch(`/api/bookings/${id}/review`),
  failBooking: (id, reason) => api.patch(`/api/bookings/${id}/fail`, { reason }),
  cancelBooking: (id, reason) => api.patch(`/api/bookings/${id}/cancel`, { reason }),
  trip: (id) => api.get(`/api/dispatch/transport/${id}`),
  tripAction: (id, action, body) => api.patch(`/api/dispatch/transport/${id}/${action}`, body ?? {}),
  integrations: () => api.get('/api/dispatch/integrations'),
  analytics: () => api.get('/api/dispatch/analytics'),
  settings: () => api.get('/api/dispatch/settings'),
  saveSettings: (changes) => api.patch('/api/dispatch/settings', changes),
  zones: () => api.get('/api/dispatch/zones'),
  saveZone: (id, payload) => (id ? api.patch(`/api/dispatch/zones/${id}`, payload) : api.post('/api/dispatch/zones', payload)),
};

export const services = {
  // Where a booking's serviceId comes from.
  list: () => api.get('/api/services'),
};

export const content = {
  // Only ever returns PUBLISHED items for a client — drafts are the
  // backend's gate for material nobody qualified has read yet.
  list: (tag) => api.get(`/api/content${tag ? `?tag=${encodeURIComponent(tag)}` : ''}`),
  get: (slug) => api.get(`/api/content/${slug}`),
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
