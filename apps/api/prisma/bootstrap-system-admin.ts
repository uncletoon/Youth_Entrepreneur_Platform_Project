import { PrismaPg } from '@prisma/adapter-pg';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { PrismaClient } from '../src/generated/prisma/client.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(directory, '../../../.env'), quiet: true });

const inputSchema = z.object({
  DATABASE_URL: z.string().url(),
  SYSTEM_ADMIN_NAME: z.string().trim().min(2).max(120),
  SYSTEM_ADMIN_EMAIL: z.string().trim().email(),
  SYSTEM_ADMIN_PASSWORD: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/, 'SYSTEM_ADMIN_PASSWORD must contain a lowercase letter.')
    .regex(/[A-Z]/, 'SYSTEM_ADMIN_PASSWORD must contain an uppercase letter.')
    .regex(/[0-9]/, 'SYSTEM_ADMIN_PASSWORD must contain a number.')
    .regex(/[^A-Za-z0-9]/, 'SYSTEM_ADMIN_PASSWORD must contain a symbol.')
    .refine((value) => !value.toLowerCase().includes('replace-with'), {
      message: 'Replace the example SYSTEM_ADMIN_PASSWORD before bootstrapping.',
    }),
  SYSTEM_ADMIN_ROTATE_PASSWORD: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});

const input = inputSchema.parse(process.env);
const adapter = new PrismaPg({ connectionString: input.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = input.SYSTEM_ADMIN_EMAIL.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing && existing.role !== 'SYSTEM_ADMIN') {
    throw new Error(
      `Refusing to promote ${email}. Change the role through an authenticated System Administrator workflow.`,
    );
  }

  if (existing) {
    const passwordHash = input.SYSTEM_ADMIN_ROTATE_PASSWORD
      ? await argon2.hash(input.SYSTEM_ADMIN_PASSWORD, { type: argon2.argon2id })
      : undefined;
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        fullName: input.SYSTEM_ADMIN_NAME,
        status: 'ACTIVE',
        ...(passwordHash ? { passwordHash } : {}),
      },
    });
    console.log(
      `System Administrator is active: ${email}${passwordHash ? ' (password rotated)' : ''}`,
    );
    return;
  }

  const passwordHash = await argon2.hash(input.SYSTEM_ADMIN_PASSWORD, {
    type: argon2.argon2id,
  });
  await prisma.user.create({
    data: {
      fullName: input.SYSTEM_ADMIN_NAME,
      email,
      passwordHash,
      role: 'SYSTEM_ADMIN',
      status: 'ACTIVE',
      consentAt: new Date(),
    },
  });
  console.log(`System Administrator created: ${email}`);
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
