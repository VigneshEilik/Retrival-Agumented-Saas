import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface AuthenticatedUser {
  userId: string;
  organizationId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      correlationId?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication token required' } });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthenticatedUser;
    req.user = payload;
    next();
  } catch (error) {
    logger.warn({ error, path: req.path }, 'Invalid access token provided');
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired authentication token' } });
  }
}

export function requireRole(allowedRoles: Array<'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Insufficient role permissions' } });
    }

    next();
  };
}
