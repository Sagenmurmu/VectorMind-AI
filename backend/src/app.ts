import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { config } from './config';
import apiRoutes from './routes';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';

export function createApp(): Express {
  const app = express();

  // Basic security and parsing middleware
  app.use(
    cors({
      origin: [config.frontendUrl, 'http://localhost:3000'],
      credentials: true,
    })
  );
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Root health probe
  app.use('/health', healthRoutes);

  // API v1 routes
  app.use('/api/v1', apiRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        message: 'Endpoint not found',
      },
    });
  });

  // Global error handler
  app.use(errorHandler);

  return app;
}
