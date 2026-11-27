import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * Error with an HTTP status and a stable machine-readable code.
 * Throw it anywhere in a request path; the central handler renders it.
 */
export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR', details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export const badRequest = (message: string, code = 'INVALID_INPUT', details?: unknown) =>
  new AppError(message, 400, code, details);
export const unauthorized = (message = 'Authentication required', code = 'UNAUTHORIZED') =>
  new AppError(message, 401, code);
export const forbidden = (message = 'Insufficient permissions', code = 'FORBIDDEN') => new AppError(message, 403, code);
export const notFound = (message = 'Resource not found', code = 'NOT_FOUND') => new AppError(message, 404, code);
export const conflict = (message: string, code = 'CONFLICT', details?: unknown) => new AppError(message, 409, code, details);

/** 404 for unknown routes. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${req.method} ${req.path}`, correlationId: req.correlationId },
  });
}

// PostgreSQL error codes worth translating into client errors.
const PG_ERRORS: Record<string, { status: number; code: string; message: string }> = {
  '22P02': { status: 400, code: 'INVALID_ID', message: 'Invalid identifier format' },
  '23505': { status: 409, code: 'ALREADY_EXISTS', message: 'Resource already exists' },
  '23503': { status: 409, code: 'REFERENCE_CONFLICT', message: 'Related resource does not exist or is in use' },
  '42501': { status: 403, code: 'FORBIDDEN', message: 'Access denied' },
};

/**
 * Central error handler. Produces one response shape for every failure:
 *   { error: { code, message, details?, correlationId } }
 * Internal error messages are never exposed in production.
 */
export function standardizedErrorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An internal server error occurred';
  let details: unknown;

  if (err instanceof AppError) {
    status = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if (err instanceof ZodError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = 'Request validation failed';
    details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
  } else if (err instanceof MulterError) {
    status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
    message = err.code === 'LIMIT_FILE_SIZE' ? `File exceeds the ${config.maxUploadMb} MB limit` : err.message;
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    code = 'MALFORMED_JSON';
    message = 'Request body is not valid JSON';
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    code = 'PAYLOAD_TOO_LARGE';
    message = 'Request body is too large';
  } else if (typeof err?.code === 'string' && PG_ERRORS[err.code]) {
    ({ status, code, message } = PG_ERRORS[err.code]);
  } else if (!config.isProduction && err?.message) {
    message = err.message; // helpful in development, hidden in production
  }

  const logPayload = { code, status, correlationId: req.correlationId, method: req.method, path: req.path };
  if (status >= 500) logger.error({ ...logPayload, err: err?.message, stack: err?.stack }, 'Unhandled server error');
  else logger.warn(logPayload, 'Request rejected');

  if (res.headersSent) return; // e.g. failure mid-stream: nothing more we can send

  res.status(status).json({
    error: { code, message, ...(details !== undefined ? { details } : {}), correlationId: req.correlationId },
  });
}
