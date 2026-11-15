import { Context, Markup, Telegraf } from 'telegraf';
import { getOrCreateParticipant, getParticipantByReferralCode } from '../../services/participant.service';
import { createReferral } from '../../services/referral.service';
import { prisma } from '../../database/client';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function registerStartCommand(bot: Telegraf) {
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
        isCompetitor: true,
      });

      // Parse deep link payload for referral code
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

      const name = escapeHtml(firstName);
      const code = escapeHtml(participant.referralCode);

      const greeting = isNew
        ? `🌟 <b>Welcome to NilePixel StarLift, ${name}!</b>`
        : `👋 <b>Welcome back, ${name}!</b>`;

      const welcomeText =
        `${greeting}\n\n` +
        `You are registered for the <b>StarLift Project Showcase Challenge</b> (Nov 15 – Nov 30, 2026)!\n\n` +
        `🔑 <b>Your Referral Code:</b> <code>${code}</code>\n\n` +
        `📊 <b>How the 70/30 Scoring Works:</b>\n` +
        `• 🤝 <b>Referrals (70%):</b> Earn points for every member who joins @NilePixelTech using your personal link.\n` +
        `• ❤️ <b>Reactions (30%):</b> Earn points from channel reactions on your showcased project post.\n\n` +
        `🚀 <b>Get Started:</b>\n` +
        `1. Tap <b>Get Invite Link</b> below to get your channel invitation link.\n` +
        `2. Share with friends and developer groups.\n` +
        `3. Monitor your rank in real-time with <b>My Stats</b>!`;

      await ctx.replyWithHTML(
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

  bot.action('cmd_start', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      if (!ctx.from) return;

      const name = escapeHtml(ctx.from.first_name ?? 'Contestant');
      await ctx.replyWithHTML(
        `🌟 <b>NilePixel StarLift — Main Menu</b>\n\n` +
          `Hello ${name}! Select an option below to manage your StarLift challenge entry:`,
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
