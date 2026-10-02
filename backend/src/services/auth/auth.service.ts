import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../db/prisma';
import { config } from '../../config';
import { RegisterInput, LoginInput } from '../../schemas/auth.schema';
import { AppError } from '../../middleware/errorHandler';

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
}

export class AuthService {
  private static readonly SALT_ROUNDS = 12;

  /**
   * Registers a new user with bcrypt-hashed credentials and returns a signed JWT.
   */
  public async register(input: RegisterInput): Promise<{ token: string; user: AuthUserPayload }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      const err: AppError = new Error('An account with this email address already exists.');
      err.statusCode = 409;
      err.code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    const passwordHash = await bcrypt.hash(input.password, AuthService.SALT_ROUNDS);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        name: input.name ? input.name.trim() : null,
      },
    });

    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Authenticates a user by email and password, returning a signed JWT.
   */
  public async login(input: LoginInput): Promise<{ token: string; user: AuthUserPayload }> {
    const normalizedEmail = input.email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user || !user.passwordHash) {
      const err: AppError = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      const err: AppError = new Error('Invalid email or password.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const token = this.generateToken(user.id, user.email);

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      },
    };
  }

  /**
   * Verifies an incoming JWT and returns the corresponding database user.
   */
  public async verifyToken(token: string): Promise<AuthUserPayload> {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as { userId: string; email: string };

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
      });

      if (!user) {
        const err: AppError = new Error('User associated with this token no longer exists.');
        err.statusCode = 401;
        err.code = 'USER_NOT_FOUND';
        throw err;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
      };
    } catch (jwtErr: any) {
      const err: AppError = new Error(
        jwtErr.name === 'TokenExpiredError'
          ? 'Authentication token has expired. Please log in again.'
          : 'Invalid authentication token.'
      );
      err.statusCode = 401;
      err.code = 'INVALID_TOKEN';
      throw err;
    }
  }

  /**
   * Issues a signed JWT.
   */
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      {
        userId,
        email,
      },
      config.auth.jwtSecret,
      {
        expiresIn: config.auth.jwtExpiresIn,
      } as any
    );
  }
}

export const authService = new AuthService();
