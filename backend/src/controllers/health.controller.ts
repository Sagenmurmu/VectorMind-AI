import { Request, Response } from 'express';
import { config } from '../config';
import { checkDatabaseConnection } from '../db/prisma';

export async function getHealthStatus(_req: Request, res: Response): Promise<void> {
  const dbHealth = await checkDatabaseConnection();
  const isHealthy = dbHealth.connected;

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    service: 'vectormind-backend',
    status: isHealthy ? 'healthy' : 'degraded',
    environment: config.nodeEnv,
    database: {
      connected: dbHealth.connected,
      ...(dbHealth.error ? { error: dbHealth.error } : {}),
    },
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
}
