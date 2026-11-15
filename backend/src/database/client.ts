import { PrismaClient } from '@prisma/client';
import logger from '../config/logger';

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export let isDbConnected = false;
export let lastDbError: string | null = null;

export const prisma: PrismaClient =
  global.__prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__prisma = prisma;
}

export async function connectDatabase(): Promise<boolean> {
  try {
    await prisma.$connect();
    isDbConnected = true;
    lastDbError = null;
    logger.info('Database connected successfully');
    return true;
  } catch (error: unknown) {
    isDbConnected = false;
    lastDbError = error instanceof Error ? error.message : 'Unknown database error';
    logger.error('⚠️ Could not connect to PostgreSQL database:', { error: lastDbError });
    logger.warn('ℹ️ Express server will remain running to serve status & setup notices to the admin UI.');
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (isDbConnected) {
    await prisma.$disconnect();
    isDbConnected = false;
    logger.info('Database disconnected');
  }
}
