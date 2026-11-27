import { Router } from 'express';
import { AuthController, signupSchema, loginSchema, refreshSchema, logoutSchema } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { rateLimiter } from '../../middleware/rate_limiter';

const router = Router();

// Brute-force protection: credentials endpoints are limited per client IP.
const credentialLimiter = rateLimiter({ name: 'auth', scope: 'ip', windowMs: 15 * 60_000, maxRequests: 20 });

router.post('/signup', credentialLimiter, validate({ body: signupSchema }), AuthController.signup);
router.post('/login', credentialLimiter, validate({ body: loginSchema }), AuthController.login);
router.post(
  '/refresh',
  rateLimiter({ name: 'refresh', scope: 'ip', windowMs: 60_000, maxRequests: 30 }),
  validate({ body: refreshSchema }),
  AuthController.refresh
);
router.post('/logout', validate({ body: logoutSchema }), AuthController.logout);
router.get('/me', authenticate, AuthController.me);

export const authRouter = router;
