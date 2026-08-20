import { Response } from 'express';
import { ErrorCode, ErrorCodes } from '../constants/errorCodes';
import { HttpStatusCode, HttpStatusCodes } from '../constants/httpStatusCodes';

export interface SuccessResponseBody<T = any> {
  success: true;
  data: T;
  meta?: Record<string, any>;
}

export interface ErrorResponseBody {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    fields?: Record<string, any>;
  };
}

export class ApiResponse {
  public static success<T>(
    res: Response,
    data: T,
    statusCode: HttpStatusCode = HttpStatusCodes.OK,
    meta?: Record<string, any>
  ): Response {
    const responseBody: SuccessResponseBody<T> = {
      success: true,
      data,
      ...(meta && { meta }),
    };
    return res.status(statusCode).json(responseBody);
  }

  public static created<T>(res: Response, data: T, meta?: Record<string, any>): Response {
    return ApiResponse.success(res, data, HttpStatusCodes.CREATED, meta);
  }

  public static error(
    res: Response,
    message: string,
    statusCode: HttpStatusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR,
    errorCode: ErrorCode | string = ErrorCodes.INTERNAL_SERVER_ERROR,
    fields?: Record<string, any>
  ): Response {
    const responseBody: ErrorResponseBody = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(fields && { fields }),
      },
    };
    return res.status(statusCode).json(responseBody);
  }
}
