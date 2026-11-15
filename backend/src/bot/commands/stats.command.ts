import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId, getReferralCount } from '../../services/participant.service';
import { calculateScores } from '../../services/scoring.service';
import { getActiveInviteLink } from '../../services/invitation.service';
import { getSubmissionByParticipantId } from '../../services/showcase.service';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function handleStats(ctx: Context) {
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);

  try {
    const participant = await getParticipantByTelegramId(telegramId);
    if (!participant || !participant.isCompetitor) {
      await ctx.reply('Please register as a contestant first by sending /start.');
      return;
    }

    const [referralCount, scores, activeLink, submission] = await Promise.all([
      getReferralCount(participant.id),
      calculateScores(),
      getActiveInviteLink(participant.id),
      getSubmissionByParticipantId(participant.id),
    ]);

    const myScore = scores.find((s) => s.id === participant.id);
    const rank = myScore?.rank ?? scores.length + 1;
    const totalParticipants = scores.length;
    const finalScore = myScore ? myScore.finalScore.toFixed(1) : '0.0';
    const reactionCount = myScore?.reactionCount ?? 0;

    const linkText = activeLink
      ? `<code>${escapeHtml(activeLink.inviteLink)}</code>`
      : '<i>Tap "Get Invite Link" below to generate your link</i>';

    const showcaseLine =
      submission?.status === 'published' && submission.channelPostUrl
        ? `• <b>Showcase Post:</b> <a href="${submission.channelPostUrl}">${submission.channelPostUrl}</a>\n`
        : submission
        ? `• <b>Showcase Submission:</b> ${submission.status.toUpperCase()} (Under Review)\n`
        : `• <b>Showcase Submission:</b> Not submitted yet (send /submit)\n`;

    const name = escapeHtml(participant.firstName);
    const code = escapeHtml(participant.referralCode);

    const text =
      `<b>Competition Statistics</b>\n\n` +
      `• <b>Contestant:</b> ${name}\n` +
      `• <b>Referral Code:</b> <code>${code}</code>\n` +
      `• <b>Current Standing:</b> Rank #${rank} of ${totalParticipants} contestants\n\n` +
      `<b>Your Performance:</b>\n` +
      `• <b>Referrals:</b> ${referralCount} members\n` +
      `• <b>Reactions:</b> ${reactionCount} reactions\n` +
      `• <b>Total Score:</b> ${finalScore} points (70% referrals + 30% reactions)\n\n` +
      `${showcaseLine}\n` +
      `<b>Your Personal Invite Link:</b>\n${linkText}\n\n` +
      `<b>Tip to improve your rank:</b>\n` +
      `Share your personal invite link with friends and communities. When people join through your link and react to your showcase post, your score increases and boosts your rank toward the top 3!`;

    const buttons = [
      [
        Markup.button.callback('Get Invite Link', 'cmd_mylink'),
        Markup.button.callback('Leaderboard', 'cmd_leaderboard'),
      ],
      [
        submission?.status === 'published' && submission.channelPostUrl
          ? Markup.button.url('View Showcase Post', submission.channelPostUrl)
          : Markup.button.callback('Update Project', 'cmd_update_submit'),
        Markup.button.callback('Refresh Stats', 'cmd_stats'),
      ],
      [
        Markup.button.callback('Main Menu', 'cmd_start'),
      ],
    ];

    await ctx.replyWithHTML(text, Markup.inlineKeyboard(buttons));
  } catch (error) {
    logger.error('Error in /stats command', { error });
    await ctx.reply('An error occurred while loading your stats. Please try again.');
  }
}

export function registerStatsCommand(bot: Telegraf) {
  bot.command('stats', async (ctx: Context) => {
    await handleStats(ctx);
  });

  bot.action('cmd_stats', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery('Refreshing statistics…');
      await handleStats(ctx);
    } catch (err) {
      logger.error('Error in cmd_stats callback', { err });
    }
  });
}
