import { createApp } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { initFcm } from './lib/fcm';
import { prisma } from './lib/prisma';

async function main() {
  // Verify DB connection
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (e) {
    logger.error({ err: e }, 'Database connection failed');
    process.exit(1);
  }

  // Initialize FCM (optional, no-op if not configured)
  initFcm();

  const app = createApp();

  // Railway provides PORT. Bind to 0.0.0.0 so container is reachable.
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`Server listening on 0.0.0.0:${env.PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down`);
    server.close(() => logger.info('HTTP server closed'));
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', e);
  process.exit(1);
});
