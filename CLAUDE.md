# Afya Nyumbani Backend — Instructions for Claude

This file is read automatically by Claude Code at the start of every
session in this repo. Read it first, before touching any code.

## What this is

Backend API for **Afya Nyumbani**, a home-care platform in Dar es
Salaam, Tanzania, owned by Joseph R Yusuph ("Headbro"). No UI yet, on
purpose — this is a backend-first build: architecture, database,
business logic, security and integrations before any mobile/web
frontend.

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

## Status as of the last cloud session (2026-09-14)

Phases 0–7 complete (Foundation, Database & Core Data Model, Auth,
Client Health Engine, Symptoms Engine, Home Care Booking Engine, Staff
Clinical Workflow, Location & Tracking). 69 Jest tests, all passing.
28 tables.

**Next up: Phase 8 — Afya AI**, the AI safety/chat layer on top of the
already-existing `AIConversation`/`AIMessage` tables and the structured
data every prior phase has been feeding it (symptom catalogue +
red-flag verdicts, vitals ranges, health insights, booking/visit
history). This is the first phase where getting the safety boundary
wrong (what the AI may say vs. must defer to a human) has real
consequences — confirm scope with the owner before building it, don't
just start.

After Phase 8, the owner's plan continues: Phase 9 (Women's Health),
Phase 10 (Nutrition), Phase 11 (Fitness), Phase 12 (Medication & Smart
Reminders), Phase 13 (Content Platform), Phase 14 (Payments & Billing),
Phase 15 (Admin/Operations Backend), Phase 16 (Analytics), Phase 17
(Testing & Security Audit), Phase 18 (API Documentation), and only then
UI/UX.

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
