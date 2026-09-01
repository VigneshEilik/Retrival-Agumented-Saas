import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function standardizedErrorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const requestId = (req.headers['x-request-id'] as string) || `req_${Date.now()}`;
  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode === 404 ? 'NOT_FOUND' : statusCode === 401 ? 'AUTH_REQUIRED' : statusCode === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR');

  logger.error(
    {
      requestId,
      code,
      statusCode,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    'API request error handled'
  );

  return res.status(statusCode).json({
    error: {
      code,
      message: err.message || 'An unexpected server error occurred',
      requestId,
    },
  });
}
