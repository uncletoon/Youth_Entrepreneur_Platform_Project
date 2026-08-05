import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { env } from '../config/env.js';

const globalDatabase = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = globalDatabase.prisma ?? new PrismaClient({ adapter });

if (env.NODE_ENV !== 'production') globalDatabase.prisma = prisma;
