# Afya Nyumbani — Backend API

Backend engine for the Afya Nyumbani home-care platform (Dar es Salaam,
Tanzania). Built backend-first on purpose — architecture, database, business
logic and security before any screen. The engine is now stable and the
mobile app lives in [`mobile/`](mobile), an Expo app that talks to the
deployed API.

**Status: Phase 0 (Foundation & Architecture) + Phase 1 (Database & Core
Data Model) + Phase 2 (Authentication & Authorization) + Phase 3 (Client
Health Engine) + Phase 4 (Symptoms Engine) + Phase 5 (Home Care Booking
Engine) + Phase 6 (Staff/Nurse Clinical Workflow) + Phase 7 (Location &
Tracking) + Phase 8 (Afya AI) + Phase 9 (Orbit — period tracking) +
Phase 10 (Nutrition) + Phase 11 (Fitness) + Phase 12 (Medications) +
Phase 13 (Content) + Phase 14 (Billing) + Phase 15 (Operations) +
Phase 16 (Analytics) + Phase 17 (Security audit) + Phase 18 (API docs)
— all 18 phases complete.**

## Stack (kept deliberately simple / free-tier friendly)

| Layer      | Choice                                   | Why |
|------------|-------------------------------------------|-----|
| Runtime    | Node.js 18+, Express                      | Runs free on Render/Railway/Fly.io |
| Database   | PostgreSQL via Sequelize                  | Free managed Postgres everywhere (Supabase/Neon/Render) |
| Auth       | JWT (access + refresh) + bcrypt           | No external auth service to pay for |
| Validation | Zod                                       | Small, no code-gen step |
| Logging    | Winston + Morgan                          | JSON logs in prod, readable logs in dev |

Prisma was tried first but its engine download is blocked by this sandbox's
network policy, so Phase 0 uses Sequelize instead — pure JavaScript, no
native binaries to download, works identically on any free host.

## What's built in Phase 0

- Project structure (`src/config`, `middleware`, `routes`, `controllers`,
  `services`, `models`, `validators`, `utils`)
- Environment config with fail-fast validation (`src/config/env.js`)
- Centralized error handling + standard API response envelope
  (`{ success, message, data }` / `{ success, message, code, errors }`)
- Request validation middleware (Zod)
- Structured logging (Winston, HTTP access logs via Morgan)
- Security baseline: Helmet, CORS allowlist, general + auth-specific rate
  limiting
- `User` model + migration (id, name, phone, email, password hash, role,
  status, timestamps)
- Role system: `CLIENT`, `STAFF`, `ADMIN`
- Full auth flow: register, login, refresh, `/me`, JWT middleware,
  `requireRole()` RBAC guard (ready for Phase 2 to build on)
- Seed data: one test client, one test nurse, one test admin
- Automated tests (Jest + Supertest) — 9 passing

## What's built in Phase 1 — Database & Core Data Model

21 new tables (22 total with `users`), modeled and migrated, covering
every entity in the plan:

- **Accounts:** `ClientProfile`, `Staff` (professional profile), `Service`
  (catalog: Home Nursing, Elderly Care, Wound Care, Physiotherapy,
  Postnatal Care, Medication Administration, Follow-up, Health Education —
  seeded)
- **Patients:** `FamilyMember` — the actual care recipient (self or a
  dependent the client manages), with relationship, permissions, and a
  primary-account-holder flag
- **Health:** `HealthProfile`, `HealthMeasurement` (BP, glucose, heart
  rate, temperature, oxygen, weight...), `Symptom`, `MenstrualCycle`
  (predictions stored but always estimates, never certainty)
- **Nutrition & Fitness:** `NutritionProfile`, `MealLog`, `WaterLog`,
  `FitnessProfile`, `WorkoutLog`, `ActivityLog`
- **Booking engine core:** `Booking` (full state machine: REQUESTED →
  ASSIGNED → ACCEPTED → ON_THE_WAY → ARRIVED → IN_PROGRESS → COMPLETED,
  plus CANCELLED/REJECTED/RESCHEDULED), `Visit` (clinical record: vitals
  snapshot, assessment, treatment notes, recommendations, follow-up,
  attachments)
- **Content:** `ContentCategory`, `Content` (unified articles/podcasts/news)
- **Notifications:** `Notification` (generic — booking, health, system,
  reminder, marketing)
- **Afya AI:** `AIConversation`, `AIMessage`

All associations (belongsTo/hasMany/hasOne) are wired in `src/models/*`.
This is schema only — full business logic for each area (symptom
red-flags, booking assignment, visit workflow, AI safety layer, cycle
predictions, meal planning, ...) is built phase by phase on top of it,
per the plan (Phases 3–13).

## What's built in Phase 2 — Authentication & Authorization

4 new tables + a full rewrite of the auth flow on top of the Phase 0 skeleton:

- **Real logout & session management** — refresh tokens are now tracked in
  `refresh_token_sessions`, not just signed JWTs. `POST /auth/logout`
  revokes one session, `POST /auth/logout-all` revokes every session for
  the user, `GET /auth/sessions` lists active sessions (device/IP/created),
  `DELETE /auth/sessions/:id` revokes one.
- **Refresh token rotation with reuse detection** — every `POST
  /auth/refresh` invalidates the token just used and issues a new one in
  the same "family". If an already-used (revoked) refresh token is
  presented again — a signal it may have been stolen — the *entire*
  family is killed and the audit log records `TOKEN_REUSE_DETECTED`.
- **Password reset** — `POST /auth/password/forgot` (always responds the
  same way whether or not the account exists, to avoid leaking who's
  registered) and `POST /auth/password/reset`. Resetting a password
  revokes every existing session.
- **Phone/email verification (OTP)** — `POST /auth/verify/request` and
  `POST /auth/verify/confirm`. Registration now leaves a user
  `PENDING_VERIFICATION` until they confirm a 6-digit code (previously
  Phase 0 set every new account `ACTIVE` immediately — this is the
  intentional behavior change). No SMS/email gateway is wired up yet
  (that's later-phase integration work), so outside `NODE_ENV=production`
  the code is returned directly in the API response so the flow is
  testable end to end.
- **Staff accounts created by registration, approved by admin** —
  registering with `role: STAFF` also creates a `Staff` profile with
  `approvalStatus: PENDING`. `GET /staff` (admin, filterable by
  `?status=`), `PATCH /staff/:id/approve`, `PATCH /staff/:id/reject`,
  `GET /staff/me` (the staff member's own profile).
- **RBAC actually enforced** — every new endpoint above uses
  `authenticate` + `requireRole()` from Phase 0; staff-only and
  admin-only routes are tested to confirm the other role gets 403.
- **Audit logs** — every security-relevant action (register, login
  success/failure, logout, token refresh/reuse, password reset,
  verification, staff approval/rejection) writes to `audit_logs`.
  `GET /admin/audit-logs` (admin only, paginated) to review them.

## What's built in Phase 3 — Client Health Engine

No new tables — this phase is the business logic and API on top of the
`FamilyMember`/`HealthProfile`/`HealthMeasurement`/`Symptom` tables from
Phase 1.

- **Auto-provisioning** — registering as a CLIENT now automatically
  creates a `ClientProfile` and a `SELF` `FamilyMember`, so a client's
  own health record is usable immediately with no extra "create my
  patient profile" step.
- **Family members (patients)** — `POST/GET /family-members`,
  `GET/PATCH /family-members/:id`. A client can add dependents (spouse,
  child, parent, ...) they manage care for. An ownership middleware
  (`loadOwnedFamilyMember`) makes sure a client can only ever touch their
  own family members — tested by confirming a *different* client gets
  403.
- **Health profile** — `GET/PUT /family-members/:id/health-profile`:
  conditions, allergies, medications, medical history, blood type,
  height. Created on first read (`findOrCreate`) so there's no separate
  "does this patient have a health profile yet" check.
- **Vitals** — full CRUD at `/family-members/:id/vitals`: BP, glucose,
  heart rate, temperature, oxygen, weight, height, BMI. Blood pressure
  requires systolic+diastolic; every other type requires a single
  `value` — validated by Zod before it reaches the database.
- **Health timeline** — `GET /family-members/:id/timeline`: merges
  vitals, symptoms, and completed visits into one chronological feed
  (computed on read, no separate timeline table), matching the example
  in the spec ("09:20 BP recorded, 11:00 Symptom added, 15:30 Nurse
  visit completed").
- **Health insights engine** — `GET /family-members/:id/insights`:
  - *trends*: direction (up/down/stable) between the latest and previous
    reading for each vitals type that has 2+ readings
  - *missing measurements*: which of BP/glucose/weight haven't been
    logged in the last 30 days
  - *abnormal readings*: rule-of-thumb range checks (documented in
    `src/utils/vitalsRanges.js`) over the last 30 days of vitals —
    explicitly labeled a signal, not a diagnosis
  - *recurring symptoms*: any symptom logged 2+ times in the last 30 days

Symptom *submission* stays a Phase 4 endpoint per the plan (the
`Symptom` table already exists from Phase 1, and the timeline/insights
above already read from it) — Phase 3 tests seed a symptom directly via
the model to prove that integration now, ahead of Phase 4 building the
actual submission API.

## What's built in Phase 4 — Symptoms Engine

One new table (27 total): `SymptomCatalogItem`, seeded with 15 common
presenting symptoms (Headache, Fever, Cough, Chest Pain, Shortness of
Breath, Abdominal Pain, Nausea, Vomiting, Diarrhea, Fatigue, Dizziness,
Joint Pain, Back Pain, Skin Rash, Swelling).

- **Symptom catalogue** — `GET /symptom-catalogue` (`?category=` filter):
  each entry carries category, common triggers, related symptoms, and
  red-flag metadata (always-flag, severity threshold, duration
  threshold).
- **Symptom submission API** — full CRUD at
  `/family-members/:id/symptoms`, filterable by name/severity/since.
  Every response enriches the submitted symptom with catalogue metadata
  when the name matches (case-insensitive) — this structured shape
  (category, triggers, related symptoms, severity, duration, frequency)
  is exactly what Phase 8's Afya AI context engine will consume.
- **Red-flag rule engine** (`src/services/symptomRules.service.js`) —
  every submission gets a verdict: flagged if (a) the catalogue marks
  the symptom as always-urgent (e.g. Chest Pain, Shortness of Breath),
  (b) reported severity is SEVERE or meets the catalogue's threshold,
  (c) duration meets the catalogue's "this has gone on too long"
  threshold, or (d) another MODERATE/SEVERE symptom was logged for the
  same patient within the last 24 hours (combination signal). The
  response always includes `reasons` and a `recommendation` — a signal
  to review, explicitly not a diagnosis.
- **Symptom trends** — `GET /family-members/:id/symptoms/trends`:
  per-symptom-name frequency in the current vs. previous 30-day window,
  direction (increasing/decreasing/stable), most severe reading, last
  occurrence.
- Same ownership rules as Phase 3 (a client can't touch another
  client's symptoms) — tested.

## What's built in Phase 5 — Home Care Booking Engine ⭐

No new tables — this is the business logic and API on top of the
`Booking`/`Staff`/`Service`/`FamilyMember` tables from Phase 1.

- **Booking creation** — `POST /api/bookings` (CLIENT only): picks a
  family member (must be the caller's own — checked against their
  `ClientProfile`, since the id arrives in the body, not a URL param
  the ownership middleware can hook into), an active service, a
  location and a future `scheduledAt`. Starts in `REQUESTED`.
- **Full lifecycle state machine**
  (`src/services/bookingStateMachine.service.js`) — every transition
  names the exact statuses it's allowed from; anything else is
  rejected with `409 CONFLICT` rather than silently corrupting the
  booking:
  - `PATCH /:id/assign` (ADMIN) — from `REQUESTED`/`REJECTED`/`RESCHEDULED` → `ASSIGNED`, sets the staff member (must be `APPROVED`)
  - `PATCH /:id/accept` / `/:id/reject` (assigned STAFF) — `ASSIGNED` → `ACCEPTED` or `REJECTED`; a reject clears `staffId` so ops can reassign someone else without the client re-booking
  - `PATCH /:id/on-the-way` → `ON_THE_WAY`, `/:id/arrive` → `ARRIVED`, `/:id/start` → `IN_PROGRESS`, `/:id/complete` → `COMPLETED` (assigned STAFF at each step)
  - `PATCH /:id/cancel` (owning CLIENT or ADMIN, reason required) — from `REQUESTED`/`ASSIGNED`/`ACCEPTED`/`ON_THE_WAY` → `CANCELLED`
  - `PATCH /:id/reschedule` (owning CLIENT) — from `REQUESTED`/`ASSIGNED`/`ACCEPTED` → `RESCHEDULED` with the new time, clearing `staffId` (needs re-assignment against the new slot)
- **Access control** (`src/middleware/bookingAccess.js`) — three
  levels, mirroring who's allowed to do what: view access (owning
  client, assigned staff, or ADMIN), owner-or-admin (cancel/reschedule
  — the client's call, or support acting for them), and
  assigned-staff-or-admin (every day-of-visit transition — tested by
  confirming the *client* gets 403 trying to `accept` their own
  booking, and the assigned staff member gets 403 acting before
  they're actually assigned).
- **Suggested staff** — `GET /:id/suggested-staff` (ADMIN): shortlists
  `APPROVED` + `AVAILABLE` staff, preferring a specialty matched to the
  service's category (Nursing→NURSE, Care→CAREGIVER,
  Rehabilitation→PHYSIOTHERAPIST, Maternal Health→NURSE) and ranking a
  service-area match to the booking's location address first. This is
  a shortlist for ops to pick from, not an auto-assignment — `/assign`
  is still a separate, explicit action.
- **List/get scoped by role** — `GET /bookings` returns only a
  client's own bookings, only a staff member's assigned bookings, or
  (ADMIN) everything; `?status=` filters any of those.
- Every transition writes an audit log entry
  (`BOOKING_CREATED`/`_ASSIGNED`/`_ACCEPTED`/.../`_CANCELLED`/etc.).

## What's built in Phase 6 — Staff/Nurse Clinical Workflow

No new tables — this is the clinical `Visit` record (defined in Phase 1)
brought to life on top of a Phase 5 booking, plus the staff-side
self-service endpoints Phase 5 deliberately deferred.

- **Staff self-service** — `PATCH /api/staff/me`: a nurse updates their
  own bio, years of experience, license number, service areas, and
  availability (`AVAILABLE`/`BUSY`/`OFFLINE`) — Phase 5's suggested-staff
  matcher reads exactly these fields. `GET /api/staff/me/schedule`: their
  own assigned bookings, soonest first, defaulting to the still-open ones
  (`?status=` to see completed/cancelled ones too).
- **Check-in** (`POST /bookings/:id/visit/check-in`, assigned STAFF) —
  the clinical start of the visit. Folds Phase 5's `ARRIVED` →
  `IN_PROGRESS` transition together with creating the `Visit` row, so
  the nurse taps one thing when they walk in the door rather than two.
  Rejected (409) if the booking isn't `ARRIVED` yet, or a visit already
  exists for this booking.
- **Visit updates** (`PATCH /bookings/:id/visit`, assigned STAFF) —
  assessment, treatment notes, recommendations, follow-up date,
  attachments, and (optionally) real **vitals** taken during the visit.
  Each vitals entry becomes a genuine `HealthMeasurement` against the
  patient's own health record — attributed to the recording nurse, using
  the same validation as Phase 3's self-logged vitals — so it shows up
  immediately in the patient's timeline/insights, not just on the visit.
  A lightweight copy is also kept on the visit's `vitalsSnapshot`.
- **Check-out** (`POST /bookings/:id/visit/check-out`, assigned STAFF) —
  closes the clinical record and completes the booking in the same
  action (finishing the visit *is* completing the booking, from the
  nurse's side). Requires an assessment on file — either set earlier via
  `PATCH` or provided in this call — as a minimal clinical-completeness
  gate; blocked (400) with none, blocked (409) if already checked out.
- **View access** (`GET /bookings/:id/visit`) — owning client, assigned
  staff, or ADMIN; a 404 before check-in, matching the booking's own
  access rules.
- Every step (`VISIT_CHECKED_IN`/`_UPDATED`/`_CHECKED_OUT`,
  `BOOKING_COMPLETED`) writes an audit log entry, same as Phase 5.

## What's built in Phase 7 — Location & Tracking

One new table (28 total): `BookingLocationPing` (append-only — the trail
of pings for a booking is its location history).

- **Recording a ping** — `POST /bookings/:id/location` (assigned STAFF):
  only accepted while the booking is `ON_THE_WAY` — before assignment
  there's no confirmed staff member to track, and once `ARRIVED` there's
  nothing left to travel towards, so it's rejected (409) outside that
  window. `lat`/`lng` are validated as real coordinates (`-90..90` /
  `-180..180`).
- **"Where's my nurse right now"** — `GET /bookings/:id/location`
  (owner/assigned staff/ADMIN, same access as the booking itself):
  the latest ping, plus — when the booking has destination coordinates
  (`locationLat`/`locationLng`, optional on `Booking` since Phase 1) —
  a straight-line distance in km (`src/utils/geo.js`, haversine
  formula), an estimated ETA in minutes (assumed 25 km/h urban average —
  no routing API, no budget for one), and a proximity read
  (`ARRIVING_SOON` within ~300m, else `EN_ROUTE`). A `stale: true` flag
  fires if the last ping is over 10 minutes old, so a dropped connection
  doesn't read as "still on the way." Every response carries an explicit
  disclaimer that this is an estimate, not traffic-aware routing —
  same "signal, not certainty" spirit as Phase 3's vitals ranges and
  Phase 4's red-flag rules. With no pings yet, or no destination
  coordinates on the booking, the relevant fields come back `null`
  rather than a guess.
- **Location history** — `GET /bookings/:id/location/history`: every
  ping for the booking, chronological.

**Not built yet:** the Afya AI safety layer (Phase 8).

## Local development

```bash
npm install
cp .env.example .env          # edit if needed
npm run db:migrate            # create all tables
npm run db:seed               # add test client/nurse/admin + service catalog + symptom catalogue
npm run dev                   # start on http://localhost:4000
npm test                      # run the test suite (69 tests)
```

You need a local Postgres running (see `docker-compose.yml` — `docker
compose up -d`, or use a native Postgres install as this build environment
did).

### Test accounts (after `npm run db:seed`)

| Role  | Phone       | Password       |
|-------|-------------|----------------|
| CLIENT | 0700000001 | Password123!   |
| STAFF  | 0700000002 | Password123!   |
| ADMIN  | 0700000003 | Password123!   |

### Quick smoke test

```bash
curl http://localhost:4000/api/health
curl http://localhost:4000/api/health/db
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"0700000002","password":"Password123!"}'
```

## API surface

| Method | Path              | Auth        | Purpose |
|--------|-------------------|-------------|---------|
| GET    | `/api/health`     | none        | Liveness check |
| GET    | `/api/health/db`  | none        | Confirms DB connectivity |
| POST   | `/api/auth/register` | none     | Create account (CLIENT or STAFF) |
| POST   | `/api/auth/login`    | none     | Login with phone or email |
| POST   | `/api/auth/refresh`  | none     | Rotates refresh token, issues a new access token |
| POST   | `/api/auth/logout`   | Bearer   | Revoke one refresh token/session |
| POST   | `/api/auth/logout-all` | Bearer | Revoke every session for this user |
| GET    | `/api/auth/sessions`   | Bearer | List active sessions |
| DELETE | `/api/auth/sessions/:id` | Bearer | Revoke one session |
| POST   | `/api/auth/password/forgot` | none | Request a password reset token |
| POST   | `/api/auth/password/reset`  | none | Reset password with that token |
| POST   | `/api/auth/verify/request`  | Bearer | Send a verification OTP (PHONE or EMAIL) |
| POST   | `/api/auth/verify/confirm`  | Bearer | Confirm the OTP, activates the account |
| GET    | `/api/auth/me`       | Bearer   | Current authenticated user |
| GET    | `/api/staff`         | Bearer (ADMIN) | List staff, filter `?status=PENDING` |
| GET    | `/api/staff/me`      | Bearer (STAFF) | The logged-in staff member's own profile |
| PATCH  | `/api/staff/me`      | Bearer (STAFF) | Update own bio/experience/license/service areas/availability |
| GET    | `/api/staff/me/schedule` | Bearer (STAFF) | Own assigned bookings, soonest first; `?status=` |
| PATCH  | `/api/staff/:id/approve` | Bearer (ADMIN) | Approve a staff account |
| PATCH  | `/api/staff/:id/reject`  | Bearer (ADMIN) | Reject a staff account |
| GET    | `/api/admin/audit-logs` | Bearer (ADMIN) | Paginated security audit trail |
| POST   | `/api/family-members`   | Bearer (CLIENT) | Add a family member (patient) |
| GET    | `/api/family-members`   | Bearer (CLIENT) | List my family members |
| GET    | `/api/family-members/:id` | Bearer (owner/ADMIN) | Get one family member |
| PATCH  | `/api/family-members/:id` | Bearer (owner/ADMIN) | Update a family member |
| GET    | `/api/family-members/:id/health-profile` | Bearer (owner/ADMIN) | Get health profile (auto-created) |
| PUT    | `/api/family-members/:id/health-profile` | Bearer (owner/ADMIN) | Update conditions/allergies/medications/... |
| POST   | `/api/family-members/:id/vitals` | Bearer (owner/ADMIN) | Record a vital |
| GET    | `/api/family-members/:id/vitals` | Bearer (owner/ADMIN) | List vitals, `?type=` filter |
| GET/PATCH/DELETE | `/api/family-members/:id/vitals/:vitalId` | Bearer (owner/ADMIN) | One vital |
| GET    | `/api/family-members/:id/timeline` | Bearer (owner/ADMIN) | Auto-generated health timeline |
| GET    | `/api/family-members/:id/insights` | Bearer (owner/ADMIN) | Trends, gaps, abnormal readings, recurring symptoms |
| GET    | `/api/symptom-catalogue` | Bearer | Browse the known-symptom catalogue, `?category=` filter |
| POST   | `/api/family-members/:id/symptoms` | Bearer (owner/ADMIN) | Log a symptom (returns catalogue enrichment + red-flag verdict) |
| GET    | `/api/family-members/:id/symptoms` | Bearer (owner/ADMIN) | List symptoms, `?name=&severity=&since=` filters |
| GET    | `/api/family-members/:id/symptoms/trends` | Bearer (owner/ADMIN) | Frequency trend per symptom name (30-day windows) |
| GET/PATCH/DELETE | `/api/family-members/:id/symptoms/:symptomId` | Bearer (owner/ADMIN) | One symptom |
| POST   | `/api/bookings` | Bearer (CLIENT) | Request a booking |
| GET    | `/api/bookings` | Bearer | List bookings, scoped to caller's role; `?status=` filter |
| GET    | `/api/bookings/:id` | Bearer (owner/assigned staff/ADMIN) | Get one booking |
| GET    | `/api/bookings/:id/suggested-staff` | Bearer (ADMIN) | Shortlist of candidate staff |
| PATCH  | `/api/bookings/:id/assign` | Bearer (ADMIN) | Assign a staff member |
| PATCH  | `/api/bookings/:id/accept` | Bearer (assigned STAFF) | Accept the assignment |
| PATCH  | `/api/bookings/:id/reject` | Bearer (assigned STAFF) | Reject it (frees the slot) |
| PATCH  | `/api/bookings/:id/on-the-way` | Bearer (assigned STAFF) | Mark en route |
| PATCH  | `/api/bookings/:id/arrive` | Bearer (assigned STAFF) | Mark arrived |
| PATCH  | `/api/bookings/:id/start` | Bearer (assigned STAFF) | Start the visit |
| PATCH  | `/api/bookings/:id/complete` | Bearer (assigned STAFF) | Complete the visit |
| PATCH  | `/api/bookings/:id/cancel` | Bearer (owner/ADMIN) | Cancel (reason required) |
| PATCH  | `/api/bookings/:id/reschedule` | Bearer (owner) | Move to a new time |
| GET    | `/api/bookings/:id/visit` | Bearer (owner/assigned staff/ADMIN) | Get the clinical visit record |
| POST   | `/api/bookings/:id/visit/check-in` | Bearer (assigned STAFF) | Start the visit (ARRIVED → IN_PROGRESS + creates the Visit) |
| PATCH  | `/api/bookings/:id/visit` | Bearer (assigned STAFF) | Update assessment/notes/recommendations/attachments; record vitals |
| POST   | `/api/bookings/:id/visit/check-out` | Bearer (assigned STAFF) | Close the visit and complete the booking |
| POST   | `/api/bookings/:id/location` | Bearer (assigned STAFF) | Record a GPS ping (only while ON_THE_WAY) |
| GET    | `/api/bookings/:id/location` | Bearer (owner/assigned staff/ADMIN) | Latest ping + distance/ETA/proximity/staleness |
| GET    | `/api/bookings/:id/location/history` | Bearer (owner/assigned staff/ADMIN) | Full ping trail for the booking |

## Free hosting — how to deploy this for TSh 0

**Database — pick one (both have a free tier that doesn't expire):**

1. **Supabase** (recommended — generous free tier, dashboard included)
   - Create a project at supabase.com → Settings → Database → copy the
     "Connection string" (URI, with password).
   - Set `DATABASE_URL` to that string and `DB_SSL=true` in your host's
     environment variables.
2. **Neon** — similar flow, serverless Postgres, also free.

**API — pick one:**

1. **Render** (recommended — simplest): New → Web Service → connect your
   GitHub repo → Build command `npm install`, Start command `npm start`
   → add the env vars from `.env.example` (with your real `DATABASE_URL`,
   `DB_SSL=true`, and two long random strings for the JWT secrets —
   generate with `openssl rand -hex 32`). Free tier sleeps after 15 minutes
   of inactivity (first request after that is slow to wake up) — fine for
   development, worth upgrading before real users depend on it.
2. **Railway** — similar flow, has a small free usage credit per month.

**Before deploying:** run `npm run db:migrate` (then `npm run db:seed` if
you want the test accounts + service catalog + symptom catalogue) once
against the hosted database, e.g. from your machine with `DATABASE_URL`
pointed at the hosted DB, so all 27 tables exist.

Play Store publishing is a separate, later step (Phase 0 has no mobile app
yet — this is the backend only) and does not depend on which free API host
you pick.

## Project layout

```
src/
  app.js            Express app (middleware + routes wiring)
  server.js          Entry point — connects DB, then starts listening
  config/            env.js, logger.js, database.js (Sequelize config)
  middleware/         auth.js, errorHandler.js, validate.js, rateLimiter.js, requestLogger.js
  models/             Sequelize models (27 — see "Phase 1/2/4" above)
  migrations/         Sequelize-CLI migrations (27)
  seeders/            Sequelize-CLI seed data (test users + service catalog + symptom catalogue)
  routes/             auth, staff, admin, familyMember, symptomCatalog, booking, health (route files)
  controllers/        auth, staff, admin, familyMember, healthProfile, vitals, timeline, insights, symptom, symptomTrends, symptomCatalog, booking, visit, location
  services/           auth, token, session, staff, audit, familyMember, healthProfile, vitals, timeline, insights, symptom, symptomRules, symptomTrends, symptomCatalog, booking, bookingStateMachine, staffMatch, visit, location
  validators/         auth, familyMember, healthProfile, vitals, symptom, booking, staff, visit, location (Zod schemas)
  utils/              apiResponse.js, appError.js, password.js, hash.js, otp.js, vitalsRanges.js, geo.js
tests/                Jest + Supertest (241 tests)
mobile/               Expo app — screens in app/, API client in lib/
```

## What's built in Phase 8 — Afya AI

Afya AI answers questions, and it does it **without a language model,
without embeddings, and without an API key**. That is a safety decision
before it is a budget one: an answer here is a vetted knowledge entry
returned word for word with its source, so there is nothing for a model
to reword into something untrue.

**The red-flag engine runs first, and depends on nothing.**
`src/services/aiRedFlags.service.js` has no database call, no network
call and no model behind it. A warning to go to hospital must not be
able to fail because something else was slow or unreachable, so it
cannot be. When a question trips a rule, retrieval never runs: the
answer is "go now", and nothing else.

Ten emergency categories, in Swahili and English: breathing difficulty,
chest pain, loss of consciousness, seizures, heavy bleeding, poisoning
and overdose, stroke signs, pregnancy emergencies, infant danger signs,
and self-harm. Self-harm carries its own wording rather than a generic
hospital instruction.

Swahili conjugates the verb, so the patterns match on stems. A
dictionary writes "kumeza sumu"; a parent types "mtoto amemeza sumu".
Both fire, along with "nimemeza" and "alimeza". Matching is plain
substring and deliberately errs towards flagging — a false alarm sends
someone to a nurse who tells them they are fine, a missed emergency
does not get a second chance.

**Answers come only from signed-off material.** `knowledge_items` holds
the knowledge base. `HEALTH_EDUCATION` entries are withheld from
retrieval entirely until a named professional signs them off;
`COMPANY_INFO` and `SERVICE_INFO` are business facts and carry no such
gate. When nothing matches, Afya AI says so and points to a nurse — it
never guesses.

**Retrieval is Postgres' own full-text search**, using the `simple` text
configuration rather than `english`, because English stemming mangles
Swahili and Postgres ships no Swahili dictionary. No vector database, no
embedding service, nothing to pay for.

**Every interaction is kept and reviewable.** `ai_interactions` records
the question, the answer, which knowledge entries it came from, and
which red-flag categories fired. Red flags always go to the review
queue and always write an audit log; a 5% sample of ordinary
interactions goes too, so review is not only ever of the alarming cases.

A question can name the FamilyMember it is about, and that member must
belong to the person asking — health data belongs to a FamilyMember,
never to a User.

| Endpoint | Who | What |
|---|---|---|
| `POST /api/ai/ask` | any signed-in user | Ask a question |
| `GET /api/ai/history` | any signed-in user | Own interactions only |
| `GET /api/ai/knowledge` | any signed-in user | Retrievable entries (admins also see pending ones) |
| `POST /api/ai/knowledge` | ADMIN | Add an entry |
| `POST /api/ai/knowledge/:id/verify` | ADMIN | Professional sign-off |
| `GET /api/ai/review` | ADMIN | Review queue, red flags first |
| `POST /api/ai/review/:id` | ADMIN | Record a review verdict |

17 tests cover it, including the conjugation cases and the sign-off gate.

## What's built in Phase 9 — Orbit (period tracking)

**Orbit** is the period tracker. The `menstrual_cycles` table has been
waiting since Phase 1, so Phase 9 is the engine and the endpoints, no
new migration.

A cycle entry is a start date, an optional end date, flow
(LIGHT/MEDIUM/HEAVY), symptoms, mood and notes, attached to a
FamilyMember. Start dates in the future are refused, an end before its
start is refused, and two cycles cannot share a start date — nonsense
in the log becomes nonsense in the average.

**Everything Orbit returns is an estimate and says so.** The response
carries `isEstimate: true` and a note in Swahili stating plainly that
it is a projection from what was logged and not medical certainty. A
cycle moves with illness, stress, travel and breastfeeding; arithmetic
over past dates knows about none of that.

Prediction is the mean gap between recent starts, over at most the last
six intervals. Confidence rises with evidence and never reaches
certain:

| | |
|---|---|
| fewer than 2 cycles | no prediction at all, and it explains why |
| 2 intervals, tightly clustered | `MEDIUM` |
| 3+ intervals, tightly clustered | `HIGH` |
| scattered history | `LOW`, plus a note offering a nurse to talk to |

Note that *n* logged cycles give *n−1* intervals. Three logged cycles
are two observations, and two observations do not earn HIGH however
closely they agree — which is why the field is named
`basedOnIntervals` rather than `basedOnCycles`.

When the logged history is scattered, Orbit says the estimate is
rougher and offers a nurse. It names no condition and diagnoses
nothing.

**No fertile window.** The columns exist on the table and are
deliberately left empty. The moment an app shows a fertile window some
users will treat it as birth control, and calendar prediction is not
reliable enough to carry that — the person it fails is the one who
bears the consequence. Adding it needs its own decision, not a quiet
default. A test asserts those columns stay null.

| Endpoint | What |
|---|---|
| `POST /api/family-members/:id/cycles` | Log a cycle |
| `GET /api/family-members/:id/cycles` | List them, newest first |
| `GET /api/family-members/:id/cycles/insights` | Averages, regularity, prediction |
| `GET /api/family-members/:id/cycles/:cycleId` | One entry |
| `PATCH /api/family-members/:id/cycles/:cycleId` | Edit |
| `DELETE /api/family-members/:id/cycles/:cycleId` | Remove |

All of it behind `loadOwnedFamilyMember`, so a client reaches only
their own people. 16 tests.

## What's built in Phase 10 — Nutrition

`NutritionProfile`, `MealLog` and `WaterLog` have existed since Phase 1.
What was missing was a way to log a meal without already knowing what a
plate of ugali comes to, so Phase 10 adds a **food catalogue**: about
forty foods people in Dar actually eat — ugali, wali, pilau, chapati,
maharage, muhogo, dagaa, mchicha, mandazi, chai ya maziwa — each with a
portion described the way it is served ("Kikombe 1", "Chapati 1") rather
than in grams nobody measures. Searchable in Swahili or English.

Two things this phase deliberately does **not** do.

**It never calculates a calorie target.** The arithmetic is trivial, but
the number that falls out is dietary advice, and it is wrong in exactly
the cases where being wrong matters: pregnancy, breastfeeding,
childhood, diabetes, recovery from illness, an eating disorder.
`dailyCalorieTarget` stays null until a person or their nurse sets one
on purpose.

**It never passes judgement on what someone ate.** The daily summary
reports what was logged, and the target if one exists. It does not say
over, under, too much, or well done, and there is no verdict field for
it to say them in. A test asserts that language stays out of the
response. An app that scolds people about food harms some of the people
using it.

Honesty about the numbers is built into the response rather than buried
in a footnote. Calorie figures are approximations for household
portions, every response carrying one sets `caloriesAreApproximate` and
a Swahili disclaimer, and `verifiedByProfessional` is false on every
catalogue row until a nutritionist goes through them. A food the
catalogue does not recognise is kept with whatever the user said and
its calories stay null — never a guess — and the summary reports how
many items its total does not cover, rather than presenting a partial
figure as a whole one. A day with nothing countable returns null, not
zero, because zero reads as having eaten nothing.

| Endpoint | What |
|---|---|
| `GET /api/foods?q=` | Search the catalogue, Swahili or English |
| `GET /api/family-members/:id/nutrition` | Profile (created on first read) |
| `PUT /api/family-members/:id/nutrition` | Goal, targets, preferences, restrictions |
| `GET /api/family-members/:id/nutrition/summary?date=` | The day, reported not judged |
| `POST/GET/DELETE /api/family-members/:id/meals` | Meal log |
| `POST/GET/DELETE /api/family-members/:id/water` | Water log |

19 tests.

## Phases 11–18

**Phase 11 — Fitness.** Workouts, daily steps and weekly totals.
Calories burned are never estimated: the formula needs body weight and
a MET value and returns a wide guess wearing a number's clothes, so the
field stays null unless the user fills it. Totals are reported against
no target, because published activity guidelines are written for
healthy adults and many people here are elderly or recovering. A REHAB
goal says outright that the plan belongs to the nurse. Daily activity
is one row per date, upserted, since a pedometer reports a running
total.

**Phase 12 — Medications.** A prescription recorded exactly as written
— the dosage is free text nothing parses — and the dose schedule
generated from it. This records and reminds; it never changes a dose,
suggests stopping a medicine, or warns about interactions. Schedule
times are wall-clock resolved against UTC+3, which Tanzania keeps all
year. Doses are generated fourteen days ahead and never into the past.
Adherence counts a dose once answered even if its slot is still hours
off, is broken down per medicine, and returns null rather than 0% when
nothing has come due. No SMS is sent — there is no gateway budget — so
the API says what is due and flags `deliveredByServer: false`.

**Phase 13 — Content.** Articles, podcasts and news. DRAFT is the gate:
content is created as a draft whatever status the caller sends,
publishing is its own endpoint, and the publisher is audited. A draft
reads as 404 to a client so unpublished titles cannot be found by
guessing slugs. A published piece keeps its slug when its title is
corrected.

**Phase 14 — Billing.** Invoices, payments and what is owed. There is
no live payment gateway: M-Pesa and the rest need a merchant account
the business does not have yet, so every payment carries
`gatewayConfirmed: false` and is keyed by a named person. Amounts are
whole shillings as integers, totals are computed server-side from the
line items, invoice numbers come from a Postgres sequence, a payment
larger than the balance is refused, and an invoice with payments
against it cannot be cancelled.

**Phase 15 — Operations.** One dashboard call: bookings today, work
awaiting assignment, visits in flight, staff awaiting approval, money
outstanding, and Afya AI's review queue. Accounts are suspended, never
deleted. An admin cannot suspend or demote themselves. Also
`npm run make-admin -- <phone>`, which solves the bootstrap problem: the
role endpoint is admin-only, so a fresh database has no way to make its
first admin through the API.

**Phase 16 — Analytics.** Aggregates only, and health breakdowns below
five are withheld — in one city with a few dozen families, "one case of
X" is a person, not a statistic. Rates return null rather than 0% when
nothing sits behind them.

**Phase 17 — Security audit.** Found and fixed: `trust proxy` was
unset, so behind Render's proxy `req.ip` was the proxy. The rate
limiter was bucketing every user into one counter and every audit log
recorded the wrong address. Set to `1`, not `true` — one hop means the
address is the one Render put there. Regression tests cover password
hashes never leaving the database, stack traces never leaking, forged
tokens, admin surfaces, privilege escalation, SQL-shaped input and
tsquery punctuation.

**Phase 18 — API documentation.** `GET /api/docs` is a browsable
reference and `GET /api/docs.json` is the OpenAPI document, both open
without a token. The document is built by walking the live Express
router rather than written by hand, so it cannot drift: a test fails
if any route lacks a description, and another fails if a description
names a route that no longer exists.

## What is not built

- **No live payment gateway.** Phase 14 keeps the books and is ready
  for one; connecting M-Pesa, Tigo Pesa or Airtel Money needs merchant
  accounts and commercial agreements.
- **No SMS or push delivery.** Reminders are exposed for the client app
  to schedule locally.
- **No language model.** Afya AI answers from vetted text on purpose —
  see the Phase 8 section.
- **No iOS build.** The Expo app is configured for both, but only
  Android has been bundled and there is no Apple developer account.
- **Not on Play Store.** The app runs today through Expo Go. Listing it
  needs a Google Play developer account, which costs money the business
  has not spent yet.
