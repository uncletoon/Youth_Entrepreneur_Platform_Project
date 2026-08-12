import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig, env } from 'prisma/config';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(configDirectory, '../../.env'), quiet: true });

export default defineConfig({
  schema: path.join(configDirectory, 'prisma/schema.prisma'),
  migrations: {
    path: path.join(configDirectory, 'prisma/migrations'),
    seed: 'tsx --env-file-if-exists=../../.env prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_ADMIN_URL ?? env('DATABASE_URL'),
  },
});
