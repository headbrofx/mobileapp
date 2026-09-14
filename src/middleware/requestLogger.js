'use strict';

const morgan = require('morgan');
const logger = require('../config/logger');

// Pipe morgan's HTTP access log lines through winston so everything
// goes through one logging pipeline / one place to redirect later.
const stream = {
  write: (message) => logger.http ? logger.http(message.trim()) : logger.info(message.trim()),
};

module.exports = morgan(
  ':method :url :status :res[content-length] - :response-time ms',
  { stream }
);
