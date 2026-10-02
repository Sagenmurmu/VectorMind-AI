import { Request, Response, NextFunction } from 'express';
import { authService, AuthUserPayload } from '../services/auth/auth.service';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required. Missing or malformed Bearer token.',
        },
      });
      return;
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Empty authentication token.',
        },
      });
      return;
    }

    const user = await authService.verifyToken(token);
    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      try {
        req.user = await authService.verifyToken(token);
      } catch {
        // Soft fail: unauthenticated request proceeds without req.user
      }
    }
  }
  next();
}
