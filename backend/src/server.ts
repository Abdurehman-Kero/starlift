import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';

// Enable JSON serialization of BigInt values
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

import { env, envValidationIssues, isDatabaseConfigured, isBotConfigured } from './config/env';
import logger from './config/logger';
import { connectDatabase, disconnectDatabase, isDbConnected, lastDbError } from './database/client';
import { apiRateLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import { startBot, isBotRunning, lastBotError } from './bot/bot';

import authRoutes from './routes/auth.routes';
import participantRoutes from './routes/participants.routes';
import referralRoutes from './routes/referrals.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import statsRoutes from './routes/stats.routes';
import settingsRoutes from './routes/settings.routes';
import activityRoutes from './routes/activity.routes';

const app = express();

// Security & parsing
app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'NilePixel StarLift API is running',
    timestamp: new Date().toISOString(),
  });
});

// System Status Endpoint (accessible by Admin Dashboard UI)
app.get('/api/system/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      server: 'running',
      port: env.PORT,
      nodeEnv: env.NODE_ENV,
      database: {
        configured: isDatabaseConfigured(),
        connected: isDbConnected,
        error: lastDbError,
      },
      bot: {
        configured: isBotConfigured(),
        running: isBotRunning,
        error: lastBotError,
      },
      envIssues: envValidationIssues,
    },
  });
});

// Middleware to guard database-dependent routes if MySQL is disconnected
const requireDatabase = (_req: Request, res: Response, next: NextFunction) => {
  if (!isDbConnected) {
    res.status(503).json({
      success: false,
      message:
        lastDbError ||
        'PostgreSQL database is not connected. Please verify DATABASE_URL in .env and ensure PostgreSQL is running.',
      databaseError: true,
    });
    return;
  }
  next();
};

// API routes
app.use('/api/auth', requireDatabase, authRoutes);
app.use('/api/participants', requireDatabase, participantRoutes);
app.use('/api/referrals', requireDatabase, referralRoutes);
app.use('/api/leaderboard', requireDatabase, leaderboardRoutes);
app.use('/api/stats', requireDatabase, statsRoutes);
app.use('/api/settings', requireDatabase, settingsRoutes);
app.use('/api/activity', requireDatabase, activityRoutes);

// 404 & error handlers (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

async function bootstrap() {
  // Start server listener first so UI proxy always connects
  const server = app.listen(env.PORT, async () => {
    logger.info(`🚀 NilePixel API server listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);

    // Connect database
    await connectDatabase();

    // Start telegram bot
    await startBot(app);
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully…`);
    server.close(async () => {
      await disconnectDatabase();
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch((err) => {
  logger.error('Bootstrap failed', { err });
});

export default app;
