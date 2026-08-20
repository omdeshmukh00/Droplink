import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { env } from '../config/env';
import { morganStream, logger } from '../utils/logger';

morgan.token('req-id', (req: Request) => req.id || 'no-id');
morgan.token('duration', (req: Request) => {
  if (!req.startTime) return '0ms';
  const duration = Date.now() - req.startTime;
  return `${duration}ms`;
});

const morganFormat = ':method :url :status :res[content-length] - :duration [req-id: :req-id]';

export const requestLogger = env.NODE_ENV === 'development'
  ? morgan(morganFormat, { stream: morganStream })
  : (req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        const duration = req.startTime ? Date.now() - req.startTime : 0;
        logger.info('HTTP Request Handled', {
          method: req.method,
          url: req.originalUrl,
          status: res.statusCode,
          durationMs: duration,
          requestId: req.id,
          ip: req.ip,
        });
      });
      next();
    };
