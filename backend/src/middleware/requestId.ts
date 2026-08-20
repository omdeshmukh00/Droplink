import { Request, Response, NextFunction } from 'express';
import { generateUUID } from '../utils/generateId';

export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const existingId = req.header('X-Request-Id');
  const requestId = existingId || generateUUID();

  req.id = requestId;
  req.startTime = Date.now();

  res.setHeader('X-Request-Id', requestId);
  next();
};
