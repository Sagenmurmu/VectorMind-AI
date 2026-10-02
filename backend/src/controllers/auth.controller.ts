import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth/auth.service';

export class AuthController {
  /**
   * POST /api/v1/auth/register
   */
  public static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.register(req.body);
      res.status(201).json({
        success: true,
        message: 'Account created successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/login
   */
  public static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await authService.login(req.body);
      res.status(200).json({
        success: true,
        message: 'Logged in successfully.',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async me(req: Request, res: Response) {
    res.status(200).json({
      success: true,
      data: {
        user: req.user,
      },
    });
  }
}
