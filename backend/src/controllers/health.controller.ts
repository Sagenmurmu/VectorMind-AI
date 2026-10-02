import { Request, Response } from 'express';
import { config } from '../config';

export function getHealthStatus(_req: Request, res: Response): void {
  res.status(200).json({
    success: true,
    service: 'vectormind-backend',
    status: 'healthy',
    environment: config.nodeEnv,
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
