import { createApp } from './app.js';
import { env } from './config/env.js';
import { prisma } from './database/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`YERSPS API listening on port ${env.PORT}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
