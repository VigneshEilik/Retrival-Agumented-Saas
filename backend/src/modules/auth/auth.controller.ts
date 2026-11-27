import { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { AppError } from '../../middleware/error_handler';
import { trimmedString } from '../../middleware/validate';

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required').max(255),
  password: z
    .string({ required_error: 'Password is required' })
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
  fullName: trimmedString(1, 255, 'Full name'),
  orgName: z.string().trim().max(255).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required').max(128),
});

export const refreshSchema = z.object({ refreshToken: z.string().min(10, 'refreshToken is required') });
export const logoutSchema = z.object({ refreshToken: z.string().optional() });

export class AuthController {
  static async signup(req: Request, res: Response) {
    const { email, password, fullName, orgName } = req.body;
    try {
      const result = await AuthService.signup(email, password, fullName, orgName);
      res.status(201).json({ data: result });
    } catch (error: any) {
      // Business-rule failures (email already registered) keep the established 400 contract;
      // anything else (e.g. database errors) goes to the central handler and is never echoed.
      if (/already exists/i.test(error?.message || '')) {
        throw new AppError('An account with this email already exists', 400, 'SIGNUP_FAILED');
      }
      throw error;
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const result = await AuthService.login(req.body.email, req.body.password);
      res.status(200).json({ data: result });
    } catch (error: any) {
      // Only genuine credential failures become 401 (same message for unknown email and wrong
      // password: no account enumeration). Infrastructure failures stay 5xx so an outage is
      // never reported to users as "wrong password".
      if (/Invalid email or password|does not belong to any organization/.test(error?.message || '')) {
        throw new AppError('Invalid email or password', 401, 'LOGIN_FAILED');
      }
      throw error;
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const tokens = await AuthService.refreshTokenRotation(req.body.refreshToken);
      res.status(200).json({ data: { tokens } });
    } catch (error: any) {
      // Token problems → 401; infrastructure failures stay 5xx (never echoed to the client).
      if (/refresh token|membership|User not found/i.test(error?.message || '')) {
        throw new AppError('Invalid or expired refresh token', 401, 'REFRESH_FAILED');
      }
      throw error;
    }
  }

  static async logout(req: Request, res: Response) {
    if (req.body.refreshToken) await AuthService.logout(req.body.refreshToken);
    res.status(200).json({ data: { message: 'Successfully logged out' } });
  }

  static async me(req: Request, res: Response) {
    const profile = req.user!.userId ? await AuthService.getProfile(req.user!.userId, req.user!.organizationId) : null;
    res.status(200).json({ data: { user: req.user, profile } });
  }
}
