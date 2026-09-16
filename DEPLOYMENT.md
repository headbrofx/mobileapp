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

Not Vercel: this is a long-running Express server with a Sequelize
connection pool. Vercel is serverless, so it would need a function
wrapper, external pooling, and the in-memory rate limiter would stop
working correctly — each lambda would keep its own counter.

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
