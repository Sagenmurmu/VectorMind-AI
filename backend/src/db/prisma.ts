import { PrismaClient } from '@prisma/client';
import { config } from '../config';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  global.prisma ||
  new PrismaClient({
    log: config.isProduction ? ['error', 'warn'] : ['error', 'warn'],
  });

if (!config.isProduction) {
  global.prisma = prisma;
}

/**
 * Health check helper for database connectivity
 */
export async function checkDatabaseConnection(): Promise<{
  connected: boolean;
  version?: string;
  error?: string;
}> {
  try {
    const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
    return {
      connected: true,
      version: result[0]?.version,
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown database error',
    };
  }
}
