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
import { startBot, isBotRunning, lastBotError, launchBotOnce, bot } from './bot/bot';

import authRoutes from './routes/auth.routes';
import participantRoutes from './routes/participants.routes';
import referralRoutes from './routes/referrals.routes';
import leaderboardRoutes from './routes/leaderboard.routes';
import statsRoutes from './routes/stats.routes';
import settingsRoutes from './routes/settings.routes';
import activityRoutes from './routes/activity.routes';
import submissionsRoutes from './routes/submissions.routes';

const app = express();

// Security & parsing
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: (origin, callback) => {
      // Reflect requesting origin to allow Vercel, localhost, and custom domains with credentials
      callback(null, origin || true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(apiRateLimiter);

// Health check endpoints
const handleHealth = (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'NilePixel StarLift API is running',
    version: '1.0.5',
    timestamp: new Date().toISOString(),
  });
};

app.get('/health', handleHealth);
app.get('/api/health', handleHealth);

// Bot reconnect trigger endpoint
app.all(['/api/bot/reconnect', '/api/bot/restart'], async (_req: Request, res: Response) => {
  const running = await launchBotOnce();
  res.json({
    success: running,
    running,
    error: lastBotError,
    timestamp: new Date().toISOString(),
  });
});

// System Status Endpoint (accessible by Admin Dashboard UI)
app.get('/api/system/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      server: 'running',
      version: '1.0.5',
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
app.use('/api/submissions', requireDatabase, submissionsRoutes);

// Telegram Webhook route (must be mounted before notFoundHandler)
app.use('/webhook', (req: Request, res: Response, next: NextFunction) => {
  if (isBotConfigured()) {
    return (bot.webhookCallback('/webhook') as any)(req, res, next);
  }
  next();
});

// 404 & error handlers (must be after all routes)
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Keeps Render free tier awake by pinging its own public health endpoint every 9 minutes.
 * Render free web services spin down after 15 minutes of inactivity; this guarantees 24/7 responsiveness.
 */
function startKeepAlive() {
  const targetUrl = process.env.RENDER_EXTERNAL_URL
    ? `${process.env.RENDER_EXTERNAL_URL}/health`
    : 'https://starlift.onrender.com/health';

  logger.info(`🔄 Keep-Alive self-pinger initialized. Target: ${targetUrl}`);

  setInterval(async () => {
    try {
      const response = await fetch(targetUrl);
      if (response.ok) {
        logger.info(`[Keep-Alive] Pinged ${targetUrl} (Status: ${response.status})`);
      } else {
        logger.warn(`[Keep-Alive] Ping to ${targetUrl} returned status ${response.status}`);
      }
    } catch (pingErr) {
      logger.warn('[Keep-Alive] Self-ping notice (will retry in 9m):', { pingErr });
    }
  }, 9 * 60 * 1000); // 9 minutes
}

async function bootstrap() {
  // Start server listener first so UI proxy always connects
  const server = app.listen(env.PORT, async () => {
    logger.info(`🚀 NilePixel API server listening on http://localhost:${env.PORT} [${env.NODE_ENV}]`);

    // Connect database
    await connectDatabase();

    // Start telegram bot
    await startBot(app);

    // Start keep-alive pinger so Render never spins down
    startKeepAlive();
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
