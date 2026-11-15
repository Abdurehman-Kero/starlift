import { Context, Markup, Telegraf } from 'telegraf';
import { getOrCreateParticipant, getParticipantByReferralCode } from '../../services/participant.service';
import { createReferral } from '../../services/referral.service';
import { prisma } from '../../database/client';
import logger from '../../config/logger';

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

export function registerStartCommand(bot: Telegraf) {
  // Handler for /start command
  bot.command('start', async (ctx: Context) => {
    if (!ctx.from) return;

    const telegramId = BigInt(ctx.from.id);
    const firstName = ctx.from.first_name ?? 'Contestant';
    const lastName = ctx.from.last_name;
    const username = ctx.from.username;

    try {
      const { participant, isNew } = await getOrCreateParticipant({
        telegramId,
        username,
        firstName,
        lastName,
      });

      // Parse deep link payload for referral code (e.g. /start 8CFA1233E1)
      const message = ctx.message;
      let referralCode: string | undefined;

      if (message && 'text' in message) {
        const parts = message.text.trim().split(/\s+/);
        if (parts.length > 1) {
          referralCode = parts[1];
        }
      }

      if (referralCode && isNew) {
        const referrer = await getParticipantByReferralCode(referralCode);
        if (referrer && referrer.id !== participant.id) {
          await createReferral({
            referrerId: referrer.id,
            referredId: participant.id,
          });

          await prisma.activityLog.create({
            data: {
              participantId: participant.id,
              action: 'REFERRAL_CREATED',
              details: JSON.stringify({ referrerId: referrer.id, referralCode }),
            },
          });

          logger.info('Referral created via start command deep-link', {
            referrerId: referrer.id,
            referredId: participant.id,
          });
        }
      }

      const escapedName = escapeMarkdownV2(firstName);
      const escapedCode = escapeMarkdownV2(participant.referralCode);

      const greeting = isNew
        ? `🌟 *Welcome to NilePixel StarLift, ${escapedName}\\!*`
        : `👋 *Welcome back, ${escapedName}\\!*`;

      const welcomeText =
        `${greeting}\n\n` +
        `You are registered for the *StarLift Project Showcase Challenge* \\(Nov 15 – Nov 30, 2026\\)\\!\n\n` +
        `🔑 *Your Referral Code:* \`${escapedCode}\`\n\n` +
        `📊 *How the 70/30 Scoring Works:*\n` +
        `• 🤝 *Referrals \\(70%\\):* Earn points for every member who joins @NilePixelTech using your personal link\\.\n` +
        `• ❤️ *Reactions \\(30%\\):* Earn points from channel reactions on your showcased project post\\.\n\n` +
        `🚀 *Get Started:*\n` +
        `1\\. Tap *Get Invite Link* below to get your channel invitation link\\.\n` +
        `2\\. Share with friends and developer groups\\.\n` +
        `3\\. Monitor your rank in real\\-time with *My Stats*\\!`;

      await ctx.replyWithMarkdownV2(
        welcomeText,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🔗 Get Invite Link', 'cmd_mylink'),
            Markup.button.callback('📊 My Stats', 'cmd_stats'),
          ],
          [
            Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
            Markup.button.callback('ℹ️ Guide & Rules', 'cmd_help'),
          ],
          [
            Markup.button.url('🚀 Open Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
          ],
          [
            Markup.button.url('💬 Project Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
          ],
        ])
      );
    } catch (error) {
      logger.error('Error in /start command', { error });
      await ctx.reply('An error occurred while loading your profile. Please try again.');
    }
  });

  // Callback query handler for returning to main start menu
  bot.action('cmd_start', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      if (!ctx.from) return;

      const firstName = escapeMarkdownV2(ctx.from.first_name ?? 'Contestant');
      await ctx.replyWithMarkdownV2(
        `🌟 *NilePixel StarLift \\- Main Menu*\n\n` +
          `Hello ${firstName}\\! Select an option below to manage your StarLift challenge entry:`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('🔗 Get Invite Link', 'cmd_mylink'),
            Markup.button.callback('📊 My Stats', 'cmd_stats'),
          ],
          [
            Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
            Markup.button.callback('ℹ️ Guide & Rules', 'cmd_help'),
          ],
          [
            Markup.button.url('🚀 Open Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
          ],
        ])
      );
    } catch (err) {
      logger.error('Error in cmd_start callback', { err });
    }
  });
}
