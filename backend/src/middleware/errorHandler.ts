import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../utils/logger';
import { HttpStatusCodes } from '../constants/httpStatusCodes';
import { ErrorCodes } from '../constants/errorCodes';
import { env } from '../config/env';

export const errorHandler: ErrorRequestHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error(`❌ Exception caught [Request ID: ${req.id || 'N/A'}]:`, {
    message: err.message,
    stack: err.stack,
    name: err.name,
    url: req.originalUrl,
    method: req.method,
  });

  // Handle AppError instance
  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.statusCode, err.errorCode, err.details);
    return;
  }

  // Handle Zod Schema Validation Error
  if (err instanceof ZodError) {
    const formattedFields: Record<string, string[]> = {};
    err.issues.forEach((issue) => {
      const field = issue.path.join('.') || 'body';
      if (!formattedFields[field]) formattedFields[field] = [];
      formattedFields[field].push(issue.message);
    });

    ApiResponse.error(
      res,
      'Invalid input parameters',
      HttpStatusCodes.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
      formattedFields
    );
    return;
  }

  // Handle Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    ApiResponse.error(
      res,
      `Invalid format for field '${err.path}'`,
      HttpStatusCodes.BAD_REQUEST,
      ErrorCodes.BAD_REQUEST
    );
    return;
  }

  // Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    ApiResponse.error(
      res,
      `Duplicate value entered for ${field}`,
      HttpStatusCodes.CONFLICT,
      ErrorCodes.CONFLICT
    );
    return;
  }

  // Fallback for unhandled/internal server errors
  const message = env.NODE_ENV === 'production'
    ? 'An unexpected error occurred on the server.'
    : err.message || 'Internal Server Error';

  ApiResponse.error(
    res,
    message,
    HttpStatusCodes.INTERNAL_SERVER_ERROR,
    ErrorCodes.INTERNAL_SERVER_ERROR
  );
};
