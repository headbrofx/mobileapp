'use strict';

const winston = require('winston');
const { env, isProduction } = require('./env');

// JSON logs in production (easy to ship to a log service later),
// readable colored logs in development.
const logger = winston.createLogger({
  level: isProduction ? 'info' : 'debug',
  format: isProduction
    ? winston.format.combine(winston.format.timestamp(), winston.format.json())
    : winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
          return `${timestamp} [${level}] ${message}${extra}`;
        })
      ),
  defaultMeta: { service: 'afya-nyumbani-api', env },
  transports: [new winston.transports.Console()],
});

module.exports = logger;
