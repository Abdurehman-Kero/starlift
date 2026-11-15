import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import { getActiveInviteLink, saveInviteLink } from '../../services/invitation.service';
import { getSetting } from '../../services/settings.service';
import { env } from '../../config/env';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function handleMyLink(ctx: Context) {
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);

  try {
    const participant = await getParticipantByTelegramId(telegramId);
    if (!participant || !participant.isCompetitor) {
      await ctx.reply('Please register as a contestant first by sending /start.');
      return;
    }

    // Check for existing active invite link
    const existing = await getActiveInviteLink(participant.id);
    if (existing) {
      const link = escapeHtml(existing.inviteLink);
      const shareText = encodeURIComponent(
        'Join the NilePixel StarLift Challenge channel here:'
      );
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(existing.inviteLink)}&text=${shareText}`;

      await ctx.replyWithHTML(
        `<b>Your Personal Invitation Link</b>\n\n` +
          `<code>${link}</code>\n\n` +
          `<b>How It Works:</b>\n` +
          `• Share this link with friends, colleagues, and developer groups.\n` +
          `• When someone joins @NilePixelTech through this link, they are credited as your referral.\n` +
          `• Track your referrals anytime with /stats.`,
        Markup.inlineKeyboard([
          [Markup.button.url('Open Channel Invite', existing.inviteLink)],
          [Markup.button.url('Share with Friends', shareUrl)],
          [
            Markup.button.callback('View My Stats', 'cmd_stats'),
            Markup.button.callback('Main Menu', 'cmd_start'),
          ],
        ])
      );
      return;
    }

    // Retrieve configured Channel ID
    const settingChannelId = await getSetting('TELEGRAM_CHANNEL_ID');
    const rawChannelId = (settingChannelId || env.TELEGRAM_CHANNEL_ID || '').trim();

    if (!rawChannelId || rawChannelId === '-1001234567890') {
      await ctx.reply(
        'The Telegram showcase channel has not been configured yet.\n\n' +
          'Please configure TELEGRAM_CHANNEL_ID in settings.'
      );
      return;
    }

    let targetChatId: string | number = rawChannelId;
    if (/^-?\d+$/.test(rawChannelId)) {
      if (!rawChannelId.startsWith('-')) {
        targetChatId = `-100${rawChannelId}`;
      }
      targetChatId = Number(targetChatId);
    } else if (!rawChannelId.startsWith('@') && !rawChannelId.startsWith('https://')) {
      targetChatId = `@${rawChannelId}`;
    }

    const linkName = `StarLift_${participant.referralCode}`.slice(0, 32);

    try {
      const created = await ctx.telegram.createChatInviteLink(targetChatId, {
        name: linkName,
        creates_join_request: false,
      });

      await saveInviteLink({
        participantId: participant.id,
        inviteLink: created.invite_link,
        inviteLinkName: linkName,
        telegramLinkId: created.name,
      });

      const link = escapeHtml(created.invite_link);
      const shareText = encodeURIComponent(
        'Join the NilePixel StarLift Challenge channel here:'
      );
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(created.invite_link)}&text=${shareText}`;

      await ctx.replyWithHTML(
        `<b>Your Personal Invitation Link</b>\n\n` +
          `<code>${link}</code>\n\n` +
          `<b>How It Works:</b>\n` +
          `• Share this link with friends, colleagues, and developer groups.\n` +
          `• When someone joins @NilePixelTech through this link, they are credited as your referral.\n` +
          `• Track your referrals anytime with /stats.`,
        Markup.inlineKeyboard([
          [Markup.button.url('Open Channel Invite', created.invite_link)],
          [Markup.button.url('Share with Friends', shareUrl)],
          [
            Markup.button.callback('View My Stats', 'cmd_stats'),
            Markup.button.callback('Main Menu', 'cmd_start'),
          ],
        ])
      );
    } catch (tgError: unknown) {
      const errorMsg =
        tgError instanceof Error ? tgError.message : 'Telegram API error';
      logger.error('Failed to create Telegram invite link', { tgError });

      await ctx.reply(
        `Could not create your invite link.\n\n` +
          `Reason: ${errorMsg}\n\n` +
          `Make sure the bot is an admin of the channel (@NilePixelTech) with "Add Members / Invite Users via Link" rights, then try again.`
      );
    }
  } catch (error) {
    logger.error('Error in /mylink command', { error });
    await ctx.reply('An error occurred while generating your invite link. Please try again.');
  }
}

export function registerMyLinkCommand(bot: Telegraf) {
  bot.command('mylink', async (ctx: Context) => {
    await handleMyLink(ctx);
  });

  bot.action('cmd_mylink', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      await handleMyLink(ctx);
    } catch (err) {
      logger.error('Error in cmd_mylink callback', { err });
    }
  });
}
