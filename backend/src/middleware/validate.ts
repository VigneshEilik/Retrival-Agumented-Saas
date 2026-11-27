import { Request, Response, NextFunction } from 'express';
import { z, ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
}

/**
 * Validates and normalises request input with zod. On success the parsed values
 * replace req.body / req.params, and parsed query is available as req.validatedQuery
 * (Express 5 makes req.query read-only). On failure a ZodError reaches the
 * central error handler and becomes a 400 VALIDATION_ERROR.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (schemas.params) req.params = schemas.params.parse(req.params);
    if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
    if (schemas.query) req.validatedQuery = schemas.query.parse(req.query);
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: any;
    }
  }
}

// Reusable schema fragments
export const uuidParam = (name = 'id') => z.object({ [name]: z.string().uuid(`${name} must be a valid UUID`) });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const trimmedString = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .min(min, `${label} must be at least ${min} characters`)
    .max(max, `${label} must be at most ${max} characters`);
