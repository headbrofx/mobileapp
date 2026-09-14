'use strict';

const app = require('./app');
const config = require('./config/env');
const logger = require('./config/logger');
const { sequelize } = require('./models');

async function start() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');

    app.listen(config.port, () => {
      logger.info(`Afya Nyumbani API listening on port ${config.port} [${config.env}]`);
    });
  } catch (err) {
    logger.error('Failed to start server', { message: err.message });
    process.exit(1);
  }
}

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason: reason?.message || reason });
});

start();
