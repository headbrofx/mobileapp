'use strict';

// Serverless entry point for Vercel.
//
// Vercel's Node runtime calls whatever this file exports as (req, res),
// and an Express app is exactly that — so the whole API is reachable
// here without a wrapper. src/app.js already exports the app without
// listening on a port; src/server.js is what binds a port, and that
// file is not used on Vercel at all.
//
// Three things behave differently here than on a long-running server,
// and they are worth knowing rather than discovering:
//
// 1. The rate limiter in src/middleware/rateLimiter.js keeps its
//    counters in memory. Each serverless instance therefore keeps its
//    own, so the brute-force guard on /auth/login is looser than it is
//    on a single always-on process. Tightening it properly needs a
//    shared store.
//
// 2. Migrations do not run here. On Render the build runs
//    `npm run db:migrate`; a Vercel function has no build step that
//    should be touching the database. Run migrations yourself before
//    deploying a schema change.
//
// 3. Connections. Every instance opens its own pool, which is why
//    DATABASE_URL must be Neon's *pooled* string — the one with
//    `-pooler` in it. Without it a burst of traffic exhausts the
//    database's connection limit. src/config/database.js already keeps
//    pool.min at 0 so idle instances hold nothing open.
//
// trust proxy is set to 1 in src/app.js, which is right for Vercel as
// well as Render: both put exactly one proxy in front of the app.

module.exports = require('../src/app');
