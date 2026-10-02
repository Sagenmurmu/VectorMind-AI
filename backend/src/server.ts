import { createApp } from './app';
import { config } from './config';

const app = createApp();

const server = app.listen(config.port, () => {
  console.log(`[VectorMind Backend] Running on http://localhost:${config.port}`);
  console.log(`[VectorMind Backend] Environment: ${config.nodeEnv}`);
  console.log(`[VectorMind Backend] Health Check: http://localhost:${config.port}/health`);
});

// Graceful shutdown handling
function handleShutdown(signal: string) {
  console.log(`\n[VectorMind Backend] Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('[VectorMind Backend] HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
