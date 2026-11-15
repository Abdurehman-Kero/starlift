import { Telegraf } from 'telegraf';
import {
  syncReactionCountForMessage,
  syncReactionDeltaForMessage,
} from '../../services/showcase.service';
import logger from '../../config/logger';

// In-memory bounded cache to deduplicate updates between bot.on and global middleware
const processedReactionUpdates = new Set<string>();

function markAndCheckIfProcessed(updateKey: string): boolean {
  if (processedReactionUpdates.has(updateKey)) {
    return true;
  }
  processedReactionUpdates.add(updateKey);

  // Keep cache small and memory-bounded
  if (processedReactionUpdates.size > 2000) {
    const oldestKeys = Array.from(processedReactionUpdates).slice(0, 1000);
    oldestKeys.forEach((key) => processedReactionUpdates.delete(key));
  }
  return false;
}

export function registerReactionHandler(bot: Telegraf) {
  // 1. Telegraf event listener for message_reaction_count (aggregated count updates)
  try {
    bot.on('message_reaction_count' as any, async (ctx: any) => {
      try {
        const updateId = ctx.update?.update_id ?? 'unknown';
        const payload = ctx.messageReactionCount || ctx.update?.message_reaction_count;
        if (!payload) return;

        const messageId = payload.message_id;
        const dedupeKey = `count_${updateId}_${messageId}`;
        if (markAndCheckIfProcessed(dedupeKey)) return;

        const reactions: Array<{ total_count?: number }> = payload.reactions || [];
        const totalCount = reactions.reduce((sum, r) => sum + (r.total_count || 0), 0);

        logger.info(
          `[Reaction Event] message_reaction_count update for message #${messageId}: ${totalCount} reactions`
        );
        await syncReactionCountForMessage(messageId, totalCount);
      } catch (err) {
        logger.error('Error handling message_reaction_count event:', { err });
      }
    });
  } catch (regErr) {
    logger.debug('Register bot.on message_reaction_count notice:', { regErr });
  }

  // 2. Telegraf event listener for message_reaction (individual subscriber reactions)
  try {
    bot.on('message_reaction' as any, async (ctx: any) => {
      try {
        const updateId = ctx.update?.update_id ?? 'unknown';
        const payload = ctx.messageReaction || ctx.update?.message_reaction;
        if (!payload) return;

        const messageId = payload.message_id;
        const dedupeKey = `reaction_${updateId}_${messageId}`;
        if (markAndCheckIfProcessed(dedupeKey)) return;

        const oldCount = (payload.old_reaction || []).length;
        const newCount = (payload.new_reaction || []).length;
        const delta = newCount - oldCount;

        const user = payload.user;
        const userMeta = user
          ? { userId: user.id, username: user.username, firstName: user.first_name }
          : undefined;

        logger.info(
          `[Reaction Event] message_reaction update for message #${messageId}: delta ${delta > 0 ? '+' : ''}${delta} (old: ${oldCount}, new: ${newCount}) from user ${user?.username ? `@${user.username}` : user?.id || 'unknown'}`
        );

        if (delta !== 0) {
          await syncReactionDeltaForMessage(messageId, delta, userMeta);
        }
      } catch (err) {
        logger.error('Error handling message_reaction event:', { err });
      }
    });
  } catch (regErr) {
    logger.debug('Register bot.on message_reaction notice:', { regErr });
  }

  // 3. Global middleware fallback to guarantee capture across all Telegram updates
  bot.use(async (ctx, next) => {
    try {
      const update = ctx.update as any;
      const updateId = update?.update_id ?? 'unknown';

      // Capture message_reaction_count
      if (update?.message_reaction_count) {
        const payload = update.message_reaction_count;
        const messageId = payload.message_id;
        const dedupeKey = `count_${updateId}_${messageId}`;

        if (!markAndCheckIfProcessed(dedupeKey)) {
          const reactions: Array<{ total_count?: number }> = payload.reactions || [];
          const totalCount = reactions.reduce((sum, r) => sum + (r.total_count || 0), 0);

          logger.info(
            `[Reaction Middleware] Captured message_reaction_count for message #${messageId}: ${totalCount} reactions`
          );
          await syncReactionCountForMessage(messageId, totalCount);
        }
      }

      // Capture message_reaction
      if (update?.message_reaction) {
        const payload = update.message_reaction;
        const messageId = payload.message_id;
        const dedupeKey = `reaction_${updateId}_${messageId}`;

        if (!markAndCheckIfProcessed(dedupeKey)) {
          const oldCount = (payload.old_reaction || []).length;
          const newCount = (payload.new_reaction || []).length;
          const delta = newCount - oldCount;

          const user = payload.user;
          const userMeta = user
            ? { userId: user.id, username: user.username, firstName: user.first_name }
            : undefined;

          logger.info(
            `[Reaction Middleware] Captured message_reaction for message #${messageId}: delta ${delta > 0 ? '+' : ''}${delta} (old: ${oldCount}, new: ${newCount})`
          );

          if (delta !== 0) {
            await syncReactionDeltaForMessage(messageId, delta, userMeta);
          }
        }
      }
    } catch (middlewareErr) {
      logger.error('Error in reaction tracking middleware:', { middlewareErr });
    }
    return next();
  });
}
