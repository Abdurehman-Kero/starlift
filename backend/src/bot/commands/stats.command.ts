import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId, getReferralCount } from '../../services/participant.service';
import { calculateScores } from '../../services/scoring.service';
import { getActiveInviteLink } from '../../services/invitation.service';
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
      await ctx.reply('🌟 Please register as a contestant first by sending /start');
      return;
    }

    const [referralCount, scores, activeLink] = await Promise.all([
      getReferralCount(participant.id),
      calculateScores(),
      getActiveInviteLink(participant.id),
    ]);

    const myScore = scores.find((s) => s.id === participant.id);
    const rank = myScore?.rank ?? scores.length + 1;
    const totalParticipants = scores.length;

    const referralScore = myScore ? (myScore.referralScore * 0.70).toFixed(1) : '0.0';
    const reactionScore = myScore ? (myScore.reactionScore * 0.30).toFixed(1) : '0.0';
    const finalScore = myScore ? myScore.finalScore.toFixed(1) : '0.0';
    const reactionCount = myScore?.reactionCount ?? 0;

    const linkText = activeLink
      ? `<code>${escapeHtml(activeLink.inviteLink)}</code>`
      : '<i>Use /mylink or tap button below to generate one</i>';

    const milestoneMsg =
      referralCount === 0
        ? '🎯 <b>Next Goal:</b> Get your first invite to appear on the leaderboard!'
        : referralCount < 5
        ? '📈 <b>Great start!</b> Keep inviting developers to climb higher!'
        : referralCount < 15
        ? "🔥 <b>You're on fire!</b> Top prize positions are within reach!"
        : '🏆 <b>Outstanding performance!</b> A true StarLift showcase champion!';

    const name = escapeHtml(participant.firstName);
    const code = escapeHtml(participant.referralCode);

    const text =
      `📊 <b>StarLift Contestant Statistics</b>\n\n` +
      `👤 <b>Contestant:</b> ${name}\n` +
      `🔑 <b>Referral Code:</b> <code>${code}</code>\n\n` +
      `👥 <b>Confirmed Referrals:</b> <b>${referralCount}</b> joins\n` +
      `❤️ <b>Project Reactions:</b> <b>${reactionCount}</b> reactions\n` +
      `🏅 <b>Current Standing:</b> <b>Rank #${rank}</b> of ${totalParticipants} contestants\n\n` +
      `📈 <b>Composite Score Breakdown:</b>\n` +
      `• 🤝 <b>Referral Score (70%):</b> <code>${referralScore} / 70.0 pts</code>\n` +
      `• ❤️ <b>Reaction Score (30%):</b> <code>${reactionScore} / 30.0 pts</code>\n` +
      `• 🎯 <b>Total Score:</b> <b>${finalScore} pts</b>\n\n` +
      `${milestoneMsg}\n\n` +
      `🔗 <b>Your Personal Link:</b>\n${linkText}`;

    await ctx.replyWithHTML(
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔗 My Invite Link', 'cmd_mylink'),
          Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
        ],
        [
          Markup.button.callback('🔄 Refresh Stats', 'cmd_stats'),
          Markup.button.callback('ℹ️ Scoring Info', 'cmd_help'),
        ],
      ])
    );
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
      await ctx.answerCbQuery('Refreshing your stats…');
      await handleStats(ctx);
    } catch (err) {
      logger.error('Error in cmd_stats callback', { err });
    }
  });
}
