import { Telegraf } from 'telegraf';
import { Application } from 'express';
import { env, isBotConfigured } from '../config/env';
import logger from '../config/logger';
import { registerStartCommand } from './commands/start.command';
import { registerMyLinkCommand } from './commands/mylink.command';
import { registerStatsCommand } from './commands/stats.command';
import { registerLeaderboardCommand } from './commands/leaderboard.command';
import { registerHelpCommand } from './commands/help.command';
import { registerChatMemberHandler } from './handlers/chatMember.handler';
import { syncBotProfileToTelegram } from '../services/botProfile.service';

export let isBotRunning = false;
export let lastBotError: string | null = null;

// Initialize Telegraf with token or dummy fallback to avoid constructor throw
const token = env.BOT_TOKEN || '000000000:dummy_token_until_env_configured';
export const bot = new Telegraf(token, {
  handlerTimeout: 90000,
});

// Register commands & handlers
registerStartCommand(bot);
registerMyLinkCommand(bot);
registerStatsCommand(bot);
registerLeaderboardCommand(bot);
registerHelpCommand(bot);
registerChatMemberHandler(bot);

async function launchWithRetry(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      try {
        await bot.telegram.deleteWebhook({ drop_pending_updates: false });
      } catch (webhookErr) {
        // deleteWebhook is non-critical for polling mode
        logger.debug('deleteWebhook notice (non-fatal):', { webhookErr });
      }

      await bot.launch({
        allowedUpdates: ['message', 'chat_member', 'callback_query'],
      });

      isBotRunning = true;
      lastBotError = null;
      logger.info('Bot running in polling mode');

      // Automatically sync bot profile, description, and commands to Telegram API
      syncBotProfileToTelegram(bot).catch((syncErr) => {
        logger.debug('Initial bot profile sync notice:', { syncErr });
      });

      return;
    } catch (err: unknown) {
      isBotRunning = false;
      lastBotError =
        err instanceof Error ? err.message : 'Failed to connect to Telegram API';
      logger.warn(
        `⚠️ [BOT] Telegram connection attempt ${attempt}/${retries} failed: ${lastBotError}. Retrying in ${delayMs / 1000}s…`
      );

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.error('⚠️ [BOT] All Telegram connection attempts exhausted. Please check your internet connection or proxy to api.telegram.org.');
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
        allowed_updates: ['message', 'chat_member', 'callback_query'],
      });

      app.use(webhookPath, bot.webhookCallback(webhookPath));
      isBotRunning = true;
      lastBotError = null;
      logger.info(`Bot running in webhook mode: ${webhookUrl}`);

      // Sync bot profile on webhook launch
      syncBotProfileToTelegram(bot).catch((syncErr) => {
        logger.debug('Initial bot profile sync notice:', { syncErr });
      });
    } else {
      await launchWithRetry(5, 3000);
    }

    // Graceful shutdown signals
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error: unknown) {
    isBotRunning = false;
    lastBotError = error instanceof Error ? error.message : 'Failed to connect to Telegram API';
    logger.error('⚠️ [BOT] Telegram bot launch failed:', { error: lastBotError });
  }
}
