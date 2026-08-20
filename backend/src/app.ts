import express, { Request, Response } from 'express';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { env } from './config/env';
import { corsMiddleware } from './config/cors';
import { requestIdMiddleware } from './middleware/requestId';
import { responseTimeMiddleware } from './middleware/responseTime';
import { requestLogger } from './middleware/requestLogger';
import { securityHeadersMiddleware } from './middleware/securityHeaders';
import { globalRateLimiter, transferRateLimiter, downloadRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { v1Routes } from './routes';
import { healthRoutes } from './routes/health.routes';
import { ApiResponse } from './utils/ApiResponse';
import { HttpStatusCodes } from './constants/httpStatusCodes';
import { ErrorCodes } from './constants/errorCodes';

const app = express();

// Trust first proxy for load balancers and reverse proxies
app.set('trust proxy', 1);

// Disable x-powered-by header
app.disable('x-powered-by');

// 1. Request ID & Response Time Tracking
app.use(requestIdMiddleware);
app.use(responseTimeMiddleware);

// 2. Helmet Security Policies & Custom Security Headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'wss:', 'ws:'],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    frameguard: { action: 'deny' },
    dnsPrefetchControl: { allow: false },
    noSniff: true,
    originAgentCluster: true,
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  })
);
app.use(securityHeadersMiddleware);

// 3. CORS configuration
app.use(corsMiddleware);

// 4. Payload Compression
app.use(compression());

// 5. HTTP Traffic Logging
app.use(requestLogger);

// 6. Body Parsing (cap JSON payload size)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 7. Health & Readiness endpoints
app.use('/', healthRoutes);

// 8. Swagger UI & OpenAPI Specification
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs/json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// 9. Tiered Rate Limiters
app.use('/api', globalRateLimiter);
app.use('/api/v1/transfers', (req, res, next) => {
  if (req.method === 'POST') {
    return transferRateLimiter(req, res, next);
  }
  next();
});
app.use('/api/v1/download', downloadRateLimiter);

// 9. API v1 Router
app.use('/api/v1', v1Routes);

// 10. 404 Handler for unmapped routes
app.use((req: Request, res: Response) => {
  ApiResponse.error(
    res,
    `Route ${req.method} ${req.originalUrl} not found`,
    HttpStatusCodes.NOT_FOUND,
    ErrorCodes.NOT_FOUND
  );
});

// 11. Centralized Error Handler
app.use(errorHandler);

export default app;
