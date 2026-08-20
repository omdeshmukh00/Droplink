import rateLimit from 'express-rate-limit';
import { ApiResponse } from '../utils/ApiResponse';
import { HttpStatusCodes } from '../constants/httpStatusCodes';
import { ErrorCodes } from '../constants/errorCodes';
import { logger } from '../utils/logger';

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Security Event: Global Rate Limit Hit', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.error(
      res,
      'Too many requests from this IP, please try again later.',
      HttpStatusCodes.TOO_MANY_REQUESTS,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    );
  },
});

export const transferRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 20, // 20 upload requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Security Event: Transfer Upload Rate Limit Hit', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.error(
      res,
      'Upload rate limit exceeded (20 uploads/minute). Please slow down.',
      HttpStatusCodes.TOO_MANY_REQUESTS,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    );
  },
});

export const downloadRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 download requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Security Event: Download Rate Limit Hit', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.error(
      res,
      'Download rate limit exceeded (100 downloads/minute). Please slow down.',
      HttpStatusCodes.TOO_MANY_REQUESTS,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    );
  },
});

export const publicRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Security Event: Public Endpoint Rate Limit Hit', {
      ip: req.ip,
      path: req.originalUrl,
      requestId: req.id,
      userAgent: req.get('user-agent'),
    });

    ApiResponse.error(
      res,
      'Public endpoint rate limit exceeded. Please slow down.',
      HttpStatusCodes.TOO_MANY_REQUESTS,
      ErrorCodes.RATE_LIMIT_EXCEEDED
    );
  },
});
