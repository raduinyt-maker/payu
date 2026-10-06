import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { randomToken } from '../lib/crypto';
import { logger } from '../config/logger';

async function main() {
  const email = env.SUPER_ADMIN_EMAIL;
  const password = env.SUPER_ADMIN_PASSWORD;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info(`Super admin already exists: ${email}`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Super Admin',
      role: 'SUPER_ADMIN',
      emailVerified: true,
    },
  });

  // Seed default payment providers
  await prisma.paymentProvider.upsert({
    where: { name: 'manual' },
    create: {
      name: 'manual',
      displayName: 'Manual Verification',
      isActive: true,
    },
    update: { isActive: true },
  });

  await prisma.paymentProvider.upsert({
    where: { name: 'providerA' },
    create: {
      name: 'providerA',
      displayName: 'Provider A (generic HTTP)',
      isActive: false,
    },
    update: {},
  });

  logger.info(`Super admin created: ${user.email}`);
  logger.info(`Webhook secret default: ${randomToken(16)} (change in production)`);
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
