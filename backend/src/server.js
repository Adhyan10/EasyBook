import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { startHoldExpiryJob } from './services/holdExpiry.js';
import { logger } from './utils/logger.js';

async function main() {
  const app = createApp();
  await connectDb();
  const server = app.listen(env.PORT, () => logger.info(`EasyBook API listening on ${env.PORT}`));

  const stopJob = startHoldExpiryJob();

  const shutdown = () => {
    stopJob();
    server.close(() => mongoose.disconnect().finally(() => process.exit(0)));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.error('Failed to start server', { err });
  process.exit(1);
});
