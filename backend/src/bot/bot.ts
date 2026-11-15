import { Telegraf, Context } from 'telegraf';
import { Application } from 'express';
import { env, isBotConfigured } from '../config/env';
import logger from '../config/logger';
import { registerStartCommand } from './commands/start.command';
import { registerMyLinkCommand } from './commands/mylink.command';
import { registerStatsCommand } from './commands/stats.command';
import { registerLeaderboardCommand } from './commands/leaderboard.command';
import { registerHelpCommand } from './commands/help.command';
import { registerSubmitCommand } from './commands/submit.command';
import { registerAdminCommand } from './commands/admin.command';
import { registerChatMemberHandler } from './handlers/chatMember.handler';
import { registerReactionHandler } from './handlers/reaction.handler';
import { syncBotProfileToTelegram } from '../services/botProfile.service';

export let isBotRunning = false;
export let lastBotError: string | null = null;
let isAttemptingLaunch = false;
let supervisorInterval: NodeJS.Timeout | null = null;

// Initialize Telegraf with token or dummy fallback to avoid constructor throw
const token = env.BOT_TOKEN || '000000000:dummy_token_until_env_configured';
export const bot = new Telegraf(token, {
  handlerTimeout: 90000,
});

// Telegraf global error catcher to prevent unhandled rejection crashes
bot.catch((err: unknown, ctx: Context) => {
  const errMsg = err instanceof Error ? err.message : String(err);
  logger.error('Telegraf unhandled error in update:', {
    error: errMsg,
    updateType: ctx?.updateType,
  });

  if (errMsg.includes('409') || errMsg.includes('Conflict')) {
    isBotRunning = false;
    lastBotError = errMsg;
  }
});

// Register commands & handlers
registerStartCommand(bot);
registerMyLinkCommand(bot);
registerStatsCommand(bot);
registerLeaderboardCommand(bot);
registerHelpCommand(bot);
registerSubmitCommand(bot);
registerAdminCommand(bot);
registerChatMemberHandler(bot);
registerReactionHandler(bot);

/**
 * Single launch attempt with cleanup. Safe to call multiple times.
 */
export async function launchBotOnce(): Promise<boolean> {
  if (isBotRunning || isAttemptingLaunch) return isBotRunning;
  if (!isBotConfigured()) {
    isBotRunning = false;
    lastBotError = 'BOT_TOKEN is missing or contains placeholder in .env';
    return false;
  }

  isAttemptingLaunch = true;
  try {
    try {
      bot.stop();
    } catch {
      // non-fatal stop
    }

    // Verify token and connectivity first
    const me = await bot.telegram.getMe();
    logger.info(`✅ Connected to Telegram as @${me.username} (${me.id})`);

    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: false });
    } catch (webhookErr) {
      logger.debug('deleteWebhook notice (non-fatal):', { webhookErr });
    }

    isBotRunning = true;
    lastBotError = null;
    isAttemptingLaunch = false;

    // Launch polling in background (bot.launch() returns a promise that resolves only when polling terminates)
    bot
      .launch({
        allowedUpdates: [
          'message',
          'chat_member',
          'my_chat_member',
          'callback_query',
          'message_reaction_count',
          'message_reaction',
        ] as any,
      })
      .then(() => {
        isBotRunning = false;
        logger.info('Bot polling stopped.');
      })
      .catch((err: unknown) => {
        isBotRunning = false;
        lastBotError = err instanceof Error ? err.message : String(err);
        logger.warn(`⚠️ [BOT] Telegram polling loop error: ${lastBotError}`);
      });

    logger.info('✅ Telegram bot successfully running in polling mode');

    // Automatically sync bot profile, description, and commands to Telegram API
    syncBotProfileToTelegram(bot).catch((syncErr) => {
      logger.debug('Initial bot profile sync notice:', { syncErr });
    });

    return true;
  } catch (err: unknown) {
    isBotRunning = false;
    isAttemptingLaunch = false;
    lastBotError =
      err instanceof Error ? err.message : 'Failed to connect to Telegram API';
    logger.warn(`⚠️ [BOT] Telegram polling launch attempt failed: ${lastBotError}`);
    return false;
  }
}

export async function startBot(app: Application): Promise<void> {
  if (!isBotConfigured()) {
    isBotRunning = false;
    lastBotError = 'BOT_TOKEN is missing or contains placeholder in .env';
    logger.warn(`⚠️ [BOT] ${lastBotError}. Telegram bot is paused until a valid token is set.`);
    return;
  }

  const isProduction = env.NODE_ENV === 'production';

  try {
    if (isProduction && env.BOT_WEBHOOK_URL) {
      const webhookPath = '/webhook';
      const webhookUrl = `${env.BOT_WEBHOOK_URL}${webhookPath}`;

      await bot.telegram.setWebhook(webhookUrl, {
        allowed_updates: [
          'message',
          'chat_member',
          'my_chat_member',
          'callback_query',
          'message_reaction_count',
          'message_reaction',
        ] as any,
      });

      isBotRunning = true;
      lastBotError = null;
      logger.info(`Bot running in webhook mode: ${webhookUrl}`);

      syncBotProfileToTelegram(bot).catch((syncErr) => {
        logger.debug('Initial bot profile sync notice:', { syncErr });
      });
      return;
    }

    // Polling mode: initial launch attempt
    await launchBotOnce();

    // Background Supervisor: Auto-reconnect if polling drops or 409 conflict resolves
    if (!supervisorInterval) {
      supervisorInterval = setInterval(async () => {
        if (!isBotRunning && isBotConfigured() && !isAttemptingLaunch) {
          logger.info('🔄 [BOT Supervisor] Retrying Telegram bot polling connection…');
          await launchBotOnce();
        }
      }, 15000);
    }

    // Graceful shutdown signals
    process.once('SIGINT', () => {
      if (supervisorInterval) clearInterval(supervisorInterval);
      bot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      if (supervisorInterval) clearInterval(supervisorInterval);
      bot.stop('SIGTERM');
    });
  } catch (error: unknown) {
    isBotRunning = false;
    lastBotError = error instanceof Error ? error.message : 'Failed to connect to Telegram API';
    logger.error('⚠️ [BOT] Telegram bot launch failed:', { error: lastBotError });
  }
}
