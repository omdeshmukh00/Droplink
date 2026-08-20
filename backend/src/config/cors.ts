import cors, { CorsOptions } from 'cors';
import { env } from './env';

const cleanUrl = (url?: string): string => {
  if (!url) return '';
  return url.replace(/\/+$/, '');
};

const configuredOrigins: string[] = [
  cleanUrl(env.CLIENT_URL),
  cleanUrl(env.CLIENT_NETWORK_URL),
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
].filter(Boolean);

export const allowedOrigins: string[] = Array.from(new Set(configuredOrigins));

const LOCAL_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+)(:\d+)?$/;

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  const normalizedOrigin = cleanUrl(origin);
  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (env.NODE_ENV === 'development' && LOCAL_ORIGIN_REGEX.test(normalizedOrigin)) return true;
  return false;
};

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
};

export const corsMiddleware = cors(corsOptions);

