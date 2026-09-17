# Afya Nyumbani Backend — Instructions for Claude

This file is read automatically by Claude Code at the start of every
session in this repo. Read it first, before touching any code.

## What this is

Backend API and mobile app for **Afya Nyumbani**, a home-care platform
in Dar es Salaam, Tanzania, owned by Joseph R Yusuph ("Headbro"). Built
backend-first on purpose: architecture, database, business logic and
security before any screen.

The backend is finished and deployed. **`mobile/` now holds an Expo
app** against it — SDK 57 with Expo Router, a drawer over a route group
so the signed-in half has navigation and the login screen does not,
tokens in SecureStore, and Swahili throughout. Read `mobile/AGENTS.md`
before touching it: SDK 57 moves faster than most training data, and
the versioned docs are the source of truth there, not memory.

Read `README.md` for the full stack, API surface, local dev setup, and
per-phase feature breakdown. This file is about *how to work on it*,
not what it does.

## The build methodology — READ THIS BEFORE DOING ANYTHING

The owner's own instruction, verbatim: **"usimpe Claude phases zote kwa
prompt moja"** — do not do all phases in one go. This project is built
**one phase at a time**, each phase a complete, tested, working
deliverable before the next one starts. Each phase follows:
OBJECTIVE → REQUIREMENTS → DATABASE → BUSINESS LOGIC → SECURITY → API →
TESTS → ACCEPTANCE CRITERIA.

If you are picking this project up fresh:
1. Check the "Status" line at the top of `README.md` for which phases
   are done.
2. Do **not** start the next phase without the owner explicitly
   confirming — ask first if it's unclear whether they want to proceed.
3. When you do build a phase, finish it completely (models → migration
   → services/controllers/routes → Zod validators → Jest tests → run
   the full suite → a quick manual smoke test) before considering it
   done. Every phase so far has shipped with all tests green.

## Status (2026-09-15)

Phases 0–18 complete — the whole planned backend. 218 Jest tests, all
passing. 37 tables.

Deployed and live:
- **API:** https://afya-nyumbani-api.onrender.com (Render, free, Frankfurt)
- **Database:** Neon, free, Frankfurt, PostgreSQL 17. A `test` branch
  carries the demo accounts and is what the suite runs against; the
  default branch is production and has the catalogues only (services,
  symptoms, and the food catalogue).
- **Repo:** `headbrofx/mobileapp`

Two things about that deployment worth knowing before you touch it:

- **Render sets `NODE_ENV=production`, so `npm ci` skips
  devDependencies.** That is why `sequelize-cli` sits in `dependencies`
  — the build runs migrations. Moving it back will break the deploy.
- **Auto-deploy does not fire.** Render's GitHub App is connected to the
  `joeroberty01-blip` account, not `headbrofx`, so there is no webhook
  on this repo. A push does not deploy; the deploy has to be triggered.

**There is no Phase 19.** The backend is finished as planned. What
remains is the UI, and the three things listed under "What is not
built" in README.md — a payment gateway, SMS delivery, and a language
model if one is ever wanted.

Phases 11–18 were built in one sitting at the owner's explicit
instruction ("complete tumalize app nzima"), overriding the one-phase-
at-a-time rule below. That was his call to make about his own rule; the
rule still stands for anything new.

## A note on Phase 8's shape

Phase 8 answers questions **without a language model, without embeddings
and without any API key**. That was not only about cost. An answer is a
signed-off knowledge entry returned word for word with its source, so
there is nothing for a model to reword into something untrue. The
red-flag engine (`src/services/aiRedFlags.service.js`) has no database,
network or model dependency at all, on purpose: an emergency warning
must not be able to fail because something else was unreachable.

If generation is ever added, it belongs as a rephrasing layer over an
already-vetted answer and must disable itself when no key is present.
Note also that free LLM tiers commonly reserve the right to train on
what is sent to them — for patient symptom descriptions that is a
privacy question, not a budget one.

The earlier Prisma-based system (the `joeroberty01-blip/Afyanyumbani`
repo, its Render services, and the "Afya nyumbani mobile app" Neon
project) is kept, not deleted. It solved this same problem in August
with a RAG engine, and its schema is worth reading before extending
this one.

## Stack decisions worth knowing

- **Sequelize, not Prisma.** Prisma was tried first in Phase 0; its
  engine binary download was blocked by the cloud sandbox's network
  policy this project was originally built in. Sequelize + `pg` +
  `sequelize-cli` has no native binaries to fetch and works identically
  everywhere — kept even now that you may be running this locally
  without that restriction, for consistency.
- **No budget yet.** The owner said so directly ("sina pesa"). Every
  design decision favors free-tier hosting (Supabase/Neon + Render/
  Railway, documented in `README.md`) and avoiding paid APIs (e.g.
  Phase 7's ETA estimate is a plain haversine-distance calculation, not
  a paid routing API).
- **FamilyMember, not User/ClientProfile, is the patient.** Every
  health record (HealthProfile, HealthMeasurement, Symptom, Booking,
  ...) attaches to a `FamilyMember` — the client themselves
  (`relationship: SELF`) or a dependent they manage care for. Never
  attach health data directly to `User` or `ClientProfile`.
- **Ownership/access-control middleware pattern.** Every resource
  scoped to a person has a `load*` + access-check middleware pair (see
  `src/middleware/ownership.js` and `src/middleware/bookingAccess.js`)
  rather than checks scattered in controllers. Follow this pattern for
  new resources.
- **Audit logging.** Every security- or business-sensitive action calls
  `logAudit()` (`src/services/audit.service.js`). Keep doing this for
  new mutations.
- **"Structured data for Afya AI."** Symptom submissions, vitals, and
  visit records are deliberately enriched with catalogue metadata and
  verdicts (see `symptom.service.js`'s `enrich()`), not just raw
  values — this is what Phase 8 is meant to consume.

## Local development

```bash
npm install
cp .env.example .env      # DATABASE_URL, JWT secrets, etc.
npm run db:migrate
npm run db:seed           # test client/nurse/admin + service catalog + symptom catalogue
npm run dev                # http://localhost:4000
npm test                   # 69 tests
```

Needs a local Postgres (native install or `docker compose up -d` — see
`docker-compose.yml`).

## Working history note

This project's Phases 0–7 were built in an Anthropic Cowork cloud
session, which could not `git push` to GitHub directly (an intentional
sandbox network policy, not a bug — the git proxy there restricts
pushes to a pre-authorized repository set with no in-session way to add
one). Code was delivered to the owner as zip files and a git bundle
instead. That restriction does not apply here — if you're reading this
in a local Claude Code session, normal `git push` should just work with
whatever credentials are configured on this machine.
