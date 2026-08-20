import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to calculate exact server response time in milliseconds
 * and append X-Response-Time and Server-Timing headers.
 */
export const responseTimeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = process.hrtime.bigint();

  const originalSend = res.send;

  res.send = function (body?: any): Response {
    const end = process.hrtime.bigint();
    // Convert nanoseconds to milliseconds with microsecond accuracy
    const durationMs = (Number(end - start) / 1_000_000).toFixed(2);
    
    if (!res.headersSent) {
      res.setHeader('X-Response-Time', `${durationMs}ms`);
      res.setHeader('Server-Timing', `app;dur=${durationMs}`);
    }
    
    return originalSend.call(this, body);
  };

  next();
};
