import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // Prevent multiple instances of Prisma Client in development hot reloading
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

export const prisma =
  globalThis.prismaGlobal ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.prismaGlobal = prisma;
}

export async function connectPrisma(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('🐘 PostgreSQL / Supabase connected successfully via Prisma');
  } catch (error) {
    logger.error('❌ Failed to connect to PostgreSQL via Prisma:', error);
  }
}

export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('🐘 PostgreSQL / Supabase disconnected gracefully.');
  } catch (error) {
    logger.error('❌ Error during Prisma disconnection:', error);
  }
}
