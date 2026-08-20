import { Response } from 'express';
import { ApiResponse } from './ApiResponse';
import { HttpStatusCode, HttpStatusCodes } from '../constants/httpStatusCodes';

export const sendSuccess = <T>(res: Response, data: T, statusCode: HttpStatusCode = HttpStatusCodes.OK) => {
  return ApiResponse.success(res, data, statusCode);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode: HttpStatusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR,
  code: string = 'INTERNAL_ERROR'
) => {
  return ApiResponse.error(res, message, statusCode, code);
};
