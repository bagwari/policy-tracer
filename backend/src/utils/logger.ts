import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, ...meta }) => {
    const extra = Object.keys(meta).length
      ? `\n  ${JSON.stringify(meta, null, 2).split('\n').join('\n  ')}`
      : '';
    return `${ts} [${level}] ${message}${extra}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), json());

export const logger = winston.createLogger({
  level:       config.LOG_LEVEL,
  format:      config.isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'policy-tracer' },
  transports:  [
    new winston.transports.Console(),
    ...(config.isProd
      ? [
          new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
          new winston.transports.File({ filename: 'logs/app.log' }),
        ]
      : []),
  ],
});
