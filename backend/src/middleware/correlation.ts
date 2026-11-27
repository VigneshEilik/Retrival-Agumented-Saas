import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Accept a caller-supplied correlation ID only if it is short and log-safe.
const SAFE_ID = /^[A-Za-z0-9._-]{8,64}$/;

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const incoming = req.headers['x-correlation-id'];
  const correlationId = typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
