/* eslint-disable no-console */
import argon2 from 'argon2';
import { prisma } from '../src/config/database';
import { logger } from '../src/utils/logger';

/**
 * Controlled CLI script to provision or seed platform administrators
 * Usage: pnpm --filter @kivora/backend exec tsx prisma/seed-admin.ts
 */
async function seedAdmin() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'admin@kivora.internal';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error(
      'FATAL: INITIAL_ADMIN_PASSWORD environment variable must be explicitly set to provision the platform administrator. Refusing to provision with a default or fallback password.'
    );
  }

  // Enforce strong password requirements for platform administrator
  if (
    adminPassword.length < 12 ||
    !/[A-Z]/.test(adminPassword) ||
    !/[a-z]/.test(adminPassword) ||
    !/[0-9]/.test(adminPassword) ||
    !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(adminPassword)
  ) {
    throw new Error(
      'INITIAL_ADMIN_PASSWORD must be at least 12 characters long and include uppercase, lowercase, numbers, and special characters.'
    );
  }

  console.log(`Checking admin existence for: ${adminEmail}`);

  const existing = await prisma.user.findUnique({
    where: { email: adminEmail.toLowerCase() },
  });

  if (existing) {
    console.log(`Admin account ${adminEmail} already exists (ID: ${existing.id}).`);
    await prisma.$disconnect();
    return;
  }

  const passwordHash = await argon2.hash(adminPassword, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  const admin = await prisma.user.create({
    data: {
      email: adminEmail.toLowerCase(),
      passwordHash,
      role: 'ADMIN',
      isActive: true,
      customerProfile: {
        create: {
          firstName: 'Platform',
          lastName: 'Administrator',
        },
      },
    },
  });

  console.log(`Admin user successfully provisioned with ID: ${admin.id}`);
  logger.info('Platform administrator provisioned via controlled CLI seed', {
    adminId: admin.id,
    email: admin.email,
  });

  await prisma.$disconnect();
}

seedAdmin().catch((err) => {
  console.error('Failed to provision platform administrator:', err);
  process.exit(1);
});
