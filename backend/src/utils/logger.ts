import winston from 'winston';
import { env } from '../config/env';

// Sensitive keys masking filter
const SENSITIVE_KEYS = ['password', 'token', 'jwt', 'secret', 'authorization', 'cookie', 'bearer'];

const redactSensitiveData = winston.format((info) => {
  const maskObject = (obj: any): void => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k))) {
        obj[key] = '[REDACTED]';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        maskObject(obj[key]);
      }
    }
  };

  maskObject(info);
  return info;
});

const devFormat = winston.format.combine(
  redactSensitiveData(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    const metaStr = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : '';
    return `[${timestamp}] [${level}]: ${message}${metaStr}`;
  })
);

const prodFormat = winston.format.combine(
  redactSensitiveData(),
  winston.format.timestamp(),
  winston.format.json()
);

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? prodFormat : devFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
  ],
});

export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};
