import { Telegraf } from 'telegraf';
import { syncReactionCountForMessage } from '../../services/showcase.service';
import logger from '../../config/logger';

export function registerReactionHandler(bot: Telegraf) {
  // 1. Telegraf event listener for message_reaction_count
  try {
    bot.on('message_reaction_count' as any, async (ctx: any) => {
      try {
        const payload = ctx.messageReactionCount || ctx.update?.message_reaction_count;
        if (!payload) return;

        const messageId = payload.message_id;
        const reactions: Array<{ total_count?: number }> = payload.reactions || [];
        const totalCount = reactions.reduce((sum, r) => sum + (r.total_count || 0), 0);

        logger.info(`Received Telegram message_reaction_count update for message #${messageId}: ${totalCount} reactions`);
        await syncReactionCountForMessage(messageId, totalCount);
      } catch (err) {
        logger.error('Error handling message_reaction_count event:', { err });
      }
    });
  } catch (regErr) {
    logger.debug('Register bot.on message_reaction_count notice:', { regErr });
  }

  // 2. Global middleware fallback to guarantee capture of reaction updates across all Telegraf versions
  bot.use(async (ctx, next) => {
    try {
      const update = ctx.update as any;
      if (update?.message_reaction_count) {
        const payload = update.message_reaction_count;
        const messageId = payload.message_id;
        const reactions: Array<{ total_count?: number }> = payload.reactions || [];
        const totalCount = reactions.reduce((sum, r) => sum + (r.total_count || 0), 0);

        logger.info(`Captured message_reaction_count in middleware for message #${messageId}: ${totalCount} reactions`);
        await syncReactionCountForMessage(messageId, totalCount);
      }
    } catch (middlewareErr) {
      logger.error('Error in reaction tracking middleware:', { middlewareErr });
    }
    return next();
  });
}

