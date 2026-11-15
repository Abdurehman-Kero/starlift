import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import { getOrCreateParticipantInviteLink } from '../../services/invitation.service';
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

    const inviteRecord = await getOrCreateParticipantInviteLink(
      participant.id,
      participant.referralCode
    );

    if (!inviteRecord) {
      await ctx.reply(
        'Could not create your invite link.\n\n' +
          'Make sure the bot is an admin of the channel (@NilePixelTech) with "Add Members / Invite Users via Link" rights, then try again.'
      );
      return;
    }

    const link = escapeHtml(inviteRecord.inviteLink);
    const shareText = encodeURIComponent(
      `Support my project in the NilePixel StarLift Challenge!\n\n` +
        `Join @NilePixelTech using my invite link:\n${inviteRecord.inviteLink}`
    );
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteRecord.inviteLink)}&text=${shareText}`;

    await ctx.replyWithHTML(
      `<b>Your Personal Invitation Link</b>\n\n` +
        `<code>${link}</code>\n\n` +
        `• <b>Referral Code:</b> <code>${escapeHtml(participant.referralCode)}</code>\n\n` +
        `<b>Recommended Immediate Action to Win:</b>\n` +
        `• Share this link with your community, developer channels, and friends who want to support you in the NilePixel StarLift Challenge.\n` +
        `• Every member who joins @NilePixelTech through your link counts directly toward your score.\n` +
        `• Once your showcase project is live, ask your community to react to your post as well!\n` +
        `• Track your referrals anytime with /stats.`,
      Markup.inlineKeyboard([
        [Markup.button.url('Open Channel Invite', inviteRecord.inviteLink)],
        [Markup.button.url('Share with Community', shareUrl)],
        [
          Markup.button.callback('View My Stats', 'cmd_stats'),
          Markup.button.callback('Main Menu', 'cmd_start'),
        ],
      ])
    );
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
