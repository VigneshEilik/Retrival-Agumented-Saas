import { Request, Response } from 'express';
import { AuthService } from './auth.service';

export class AuthController {
  static async signup(req: Request, res: Response) {
    try {
      const { email, password, fullName, orgName } = req.body;
      if (!email || !password || !fullName) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email, password, and fullName are required' } });
      }

      if (password.length < 8) {
        return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });
      }

      const result = await AuthService.signup(email, password, fullName, orgName);
      return res.status(201).json({ data: result });
    } catch (error: any) {
      return res.status(400).json({ error: { code: 'SIGNUP_FAILED', message: error.message } });
    }
  }

  static async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'Email and password are required' } });
      }

      const result = await AuthService.login(email, password);
      return res.status(200).json({ data: result });
    } catch (error: any) {
      return res.status(401).json({ error: { code: 'LOGIN_FAILED', message: error.message } });
    }
  }

  static async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'refreshToken is required' } });
      }

      const tokens = await AuthService.refreshTokenRotation(refreshToken);
      return res.status(200).json({ data: { tokens } });
    } catch (error: any) {
      return res.status(401).json({ error: { code: 'REFRESH_FAILED', message: error.message } });
    }
  }

  static async logout(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;
      if (refreshToken) {
        await AuthService.logout(refreshToken);
      }
      return res.status(200).json({ data: { message: 'Successfully logged out' } });
    } catch (error: any) {
      return res.status(500).json({ error: { code: 'LOGOUT_FAILED', message: error.message } });
    }
  }

  static async me(req: Request, res: Response) {
    return res.status(200).json({ data: { user: req.user } });
  }
}
