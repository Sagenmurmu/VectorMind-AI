import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  const defaultCodes: Record<number, string> = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    422: 'UNPROCESSABLE_ENTITY',
    500: 'INTERNAL_SERVER_ERROR',
  };

  const code = err.code || defaultCodes[statusCode] || 'ERROR';

  console.error(`[Error] [${code}] ${statusCode} - ${message}`);
  if (!config.isProduction && err.stack) {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      ...(!config.isProduction && err.stack ? { stack: err.stack } : {}),
    },
  });
}
