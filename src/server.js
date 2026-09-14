'use strict';

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');

function start() {
  // Bind the port first, then check the database.
  //
  // The old order authenticated first and called process.exit(1) on
  // failure. On a free host that is a trap: Neon suspends an idle
  // database, so a cold boot can easily hit a database that needs a few
  // seconds to wake. Exiting there means Render never sees the process
  // reach a listening state, the health check never gets an answer, and
  // the service goes into a restart loop instead of recovering on its
  // own a moment later.
  //
  // /api/health stays honest either way — it is a liveness check that
  // never touches the database. /api/health/db is the readiness check
  // and reports the real connection state.
  const server = app.listen(config.port, () => {
    logger.info(`Afya Nyumbani API listening on port ${config.port} [${config.env}]`);
  });

  sequelize
    .authenticate()
    .then(() => logger.info('Database connection established'))
    .catch((err) =>
      logger.error(
        'Database unreachable at boot — the API is listening, but any request that needs data will fail until the database recovers',
        { message: err.message }
      )
    );

  // Render sends SIGTERM on every deploy and when a free instance is put
  // to sleep. Close the pool so those connections are handed back rather
  // than left for the database to time out — the free tier does not have
  // many to spare.
  const shutdown = (signal) => () => {
    logger.info(`${signal} received, shutting down`);
    server.close(async () => {
      try {
        await sequelize.close();
      } catch (err) {
        logger.error('Error closing database pool', { message: err.message });
      }
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown('SIGTERM'));
  process.on('SIGINT', shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
});

start();
