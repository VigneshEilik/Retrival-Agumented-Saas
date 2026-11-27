import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { logger } from '../utils/logger';
import { requestContext } from '../utils/request-context';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface AuthenticatedUser {
  /** Null when the caller is an API key (machine principal). */
  userId: string | null;
  organizationId: string;
  role: Role;
  authType: 'jwt' | 'api_key';
  apiKeyId?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

export const API_KEY_PREFIX = 'sk_live_';

/** API keys act with MEMBER rights: they can manage documents and query, but not administer the org. */
const API_KEY_ROLE: Role = 'MEMBER';

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

function extractApiKey(req: Request): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ') && auth.slice(7).startsWith(API_KEY_PREFIX)) return auth.slice(7).trim();
  return null;
}

function reject(res: Response, code: string, message: string, correlationId?: string) {
  return res.status(401).json({ error: { code, message, correlationId } });
}

/**
 * Authenticates either a user (JWT access token) or an integration (API key).
 * Either way req.user carries the organisation; every data access then runs
 * under that organisation's RLS context.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const apiKey = extractApiKey(req);

  if (apiKey) {
    if (!apiKey.startsWith(API_KEY_PREFIX) || apiKey.length < 40) {
      return reject(res, 'INVALID_API_KEY', 'Invalid API key', req.correlationId);
    }
    try {
      // resolve_api_key is SECURITY DEFINER: it can look the key up before tenant context exists,
      // and only returns a row for keys that are not revoked and not expired.
      const result = await pool.query('SELECT api_key_id, organization_id FROM resolve_api_key($1)', [hashApiKey(apiKey)]);
      if (result.rows.length === 0) {
        return reject(res, 'INVALID_API_KEY', 'API key is invalid, revoked or expired', req.correlationId);
      }
      req.user = {
        userId: null,
        organizationId: result.rows[0].organization_id,
        role: API_KEY_ROLE,
        authType: 'api_key',
        apiKeyId: result.rows[0].api_key_id,
      };
      return requestContext.run({ userId: null, apiKeyId: req.user.apiKeyId }, next);
    } catch (error) {
      logger.error({ err: (error as Error).message }, 'API key resolution failed');
      return next(error);
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reject(res, 'UNAUTHORIZED', 'Authentication token or API key required', req.correlationId);
  }

  try {
    const payload = jwt.verify(authHeader.slice(7), config.jwtSecret, { algorithms: ['HS256'] }) as any;
    if (!payload?.userId || !payload?.organizationId || !payload?.role) {
      return reject(res, 'INVALID_TOKEN', 'Malformed authentication token', req.correlationId);
    }
    req.user = { userId: payload.userId, organizationId: payload.organizationId, role: payload.role, authType: 'jwt' };
    // Everything downstream of this request (including async DB work) knows the acting user.
    return requestContext.run({ userId: payload.userId }, next);
  } catch {
    return reject(res, 'INVALID_TOKEN', 'Invalid or expired authentication token', req.correlationId);
  }
}

export function requireRole(allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Insufficient role permissions', correlationId: req.correlationId },
      });
    }
    next();
  };
}

/** For endpoints that only make sense for a signed-in person (not an API key). */
export function requireUser(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.userId) {
    return res.status(403).json({
      error: { code: 'USER_SESSION_REQUIRED', message: 'This endpoint requires a signed-in user, not an API key' },
    });
  }
  next();
}
