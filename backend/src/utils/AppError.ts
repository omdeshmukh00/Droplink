import { ErrorCode, ErrorCodes } from '../constants/errorCodes';
import { HttpStatusCode, HttpStatusCodes } from '../constants/httpStatusCodes';

export class AppError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly errorCode: ErrorCode;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: HttpStatusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode = ErrorCodes.INTERNAL_SERVER_ERROR,
    isOperational = true,
    details?: Record<string, any>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  public static badRequest(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, HttpStatusCodes.BAD_REQUEST, ErrorCodes.BAD_REQUEST, true, details);
  }

  public static validationError(message: string, details?: Record<string, any>): AppError {
    return new AppError(message, HttpStatusCodes.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR, true, details);
  }

  public static unauthorized(message = 'Unauthorized access'): AppError {
    return new AppError(message, HttpStatusCodes.UNAUTHORIZED, ErrorCodes.UNAUTHORIZED);
  }

  public static forbidden(message = 'Access forbidden'): AppError {
    return new AppError(message, HttpStatusCodes.FORBIDDEN, ErrorCodes.FORBIDDEN);
  }

  public static notFound(message = 'Resource not found'): AppError {
    return new AppError(message, HttpStatusCodes.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }

  public static conflict(message: string): AppError {
    return new AppError(message, HttpStatusCodes.CONFLICT, ErrorCodes.CONFLICT);
  }

  public static tooManyRequests(message = 'Rate limit exceeded'): AppError {
    return new AppError(message, HttpStatusCodes.TOO_MANY_REQUESTS, ErrorCodes.RATE_LIMIT_EXCEEDED);
  }

  public static internal(message = 'Internal server error'): AppError {
    return new AppError(message, HttpStatusCodes.INTERNAL_SERVER_ERROR, ErrorCodes.INTERNAL_SERVER_ERROR, false);
  }
}
