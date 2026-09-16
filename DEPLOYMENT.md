# Deploying the Afya Nyumbani API

This is already deployed. What follows is what it runs on, what is
still outstanding, and how to do it again from nothing.

| | |
|---|---|
| **API** | https://afya-nyumbani-api.onrender.com |
| **Docs** | https://afya-nyumbani-api.onrender.com/api/docs |
| **Host** | Render, free plan, Frankfurt — service `afya-nyumbani-api` |
| **Database** | Neon, free plan, Frankfurt, PostgreSQL 17 |
| **Repo** | `headbrofx/mobileapp`, branch `main` |

Frankfurt on both sides on purpose: it is the closest Render region to
Dar es Salaam, and putting the database beside the app rather than in
Oregon is the difference between a 220ms round trip and a second.

Render was chosen because this is a long-running Express server with a
Sequelize connection pool, which suits an always-on process better than
a serverless one. The repo also deploys to **Vercel** — see that
section below for what changes there, and it does change things worth
knowing.

---

## Still outstanding

**1. The health check path is not set.** `render.yaml` declares
`/api/health`, but the service was created through the API, which has
no field for it. Without it Render will not notice a process that has
hung. One click: Render dashboard → the service → Settings → Health
Check Path → `/api/health`.

**2. Auto-deploy does not fire.** Render's GitHub App is connected to
the `joeroberty01-blip` account; the repo lives under `headbrofx`, so
there is no webhook on it. A push does not deploy — the deploy has to
be triggered. To fix: GitHub → Settings → Applications → Render →
Configure → add `headbrofx/mobileapp`.

**3. The knowledge base is empty.** Afya AI declines every ordinary
question until it has something signed off to answer from. The
red-flag engine needs no setup and works already.

---

## ⚠️ Never seed demo users into production

`npm run db:seed` runs **all** seeders, and
`src/seeders/20260914000001-demo-users.js` inserts three live accounts
with the password `Password123!` — including an **ADMIN** on phone
`0700000003`. That password is written down in `README.md`. Seeding it
into a public database hands admin access to anyone who reads the repo.

Production needs the reference data but not the demo users:

```bash
npx sequelize-cli db:seed --seed 20260914000002-demo-services.js
```

```bash
npx sequelize-cli db:seed --seed 20260914000003-symptom-catalogue.js
```

```bash
npx sequelize-cli db:seed --seed 20260915000004-food-catalogue.js
```

The full `npm run db:seed` is for a local database or the Neon `test`
branch only.

## Making the first admin

The role endpoint is admin-only, so a fresh database has no way to make
its first admin through the API. Register normally, then:

```bash
npm run make-admin -- 07XXXXXXXX
```

It needs shell access and `DATABASE_URL`, which is a fair bar for the
one account that can promote every other. It never creates an account
and never sets a password.

---

## Doing it again from nothing

Free-tier limits change often — check the current numbers rather than
trusting this file.

**1. Database.** Create a Neon project in Frankfurt. Copy the
**pooled** connection string, the one with `-pooler` in it. Optionally
create a second branch named `test`; that is what the suite runs
against, so tests never touch production data.

**2. Locally.**

```bash
cp .env.example .env
```

Set `DATABASE_URL`, `DB_SSL=true`, and two different secrets from
`openssl rand -hex 32`.

```bash
npm install && npm run db:migrate && npm test
```

**3. Render.** New → Blueprint, pick the repo. `render.yaml` declares
the service; set `DATABASE_URL` by hand, and Render generates the JWT
secrets itself. The build runs `npm ci && npm run db:migrate`, so
migrations apply on every deploy.

`sequelize-cli` sits in `dependencies`, not `devDependencies`, because
Render sets `NODE_ENV=production` and `npm ci` then skips dev
dependencies entirely. Moving it back breaks the build — that is how
the first deploy failed.

**4. Verify.**

```bash
curl https://afya-nyumbani-api.onrender.com/api/health
```

```bash
curl https://afya-nyumbani-api.onrender.com/api/health/db
```

`/api/health` never touches the database, so it stays honest when
Postgres is down. `/api/health/db` is the readiness check.

---

## Deploying to Vercel instead

The repo is set up for this as well: `api/index.js` is the serverless
entry point and `vercel.json` sends every path to it. `src/app.js`
already exports the app without listening, so no wrapper is needed.

**In the Vercel dashboard:** Add New → Project → import
`headbrofx/mobileapp`. Framework preset: Other. Leave the build command
empty. Then set the environment variables before the first deploy:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the Neon **pooled** string — the one with `-pooler` |
| `DB_SSL` | `true` |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | a different one |
| `NODE_ENV` | `production` |
| `CORS_ORIGINS` | your app's origins, or leave unset for `*` |

Reuse the same JWT secrets as Render only if you want tokens issued by
one to work on the other. Different secrets mean the two deployments
cannot read each other's tokens, which is usually what you want.

### What changes on Vercel

**Migrations do not run.** On Render the build runs
`npm run db:migrate`. A Vercel function has no build step that should
be touching the database, so run migrations yourself before deploying a
schema change:

```bash
npm run db:migrate
```

**The rate limiter gets looser.** Its counters live in memory, so every
serverless instance keeps its own. The brute-force guard on
`/auth/login` still works within an instance but no longer across them.
Tightening it properly needs a shared store such as Redis.

**Connections matter more.** Every instance opens its own pool, which
is why `DATABASE_URL` must be the pooled Neon string. Without it a
burst of traffic exhausts the database's connection limit.
`src/config/database.js` keeps `pool.min` at 0, so idle instances hold
nothing open.

**No sleeping.** Unlike Render's free tier there is no 15-minute
shutdown, so the first request after a quiet spell is a cold start of a
second or two rather than a minute. Neon still suspends on its own
though, so the first database call after idle is slower.

`trust proxy` is 1, which is right for Vercel as well as Render: both
put exactly one proxy in front of the app.

### Running both at once

Nothing stops it — they are stateless and share the database. You get
two URLs serving the same API. Worth deciding which one is the real one
before a mobile app hardcodes the wrong address.

---

## What to expect on the free tier

- **The service sleeps** after ~15 minutes with no traffic. The next
  request takes 30–60 seconds while it wakes. Harmless during
  development; not acceptable once real clients depend on it.
- **Neon suspends an idle database** too. `src/config/database.js` is
  set up for this: `pool.min: 0` so no dead connections are held, plus
  a retry limited to connection-level errors.
- **The server survives a sleeping database.** `src/server.js` binds
  the port before authenticating, so a cold boot against a waking
  database does not put Render into a restart loop.
- **Rate limiting is per-instance and in memory.** Fine for one free
  instance; it needs a shared store before scaling to several.
- **`trust proxy` is 1.** Render terminates TLS at its proxy, so
  without this the rate limiter buckets every user together and audit
  logs record the proxy's address rather than the person's. `1`, not
  `true`: trusting every hop would let a caller set their own
  `X-Forwarded-For` and pick their own bucket.
