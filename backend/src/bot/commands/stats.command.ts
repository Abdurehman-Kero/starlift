import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId, getReferralCount } from '../../services/participant.service';
import { calculateScores } from '../../services/scoring.service';
import { getActiveInviteLink } from '../../services/invitation.service';
import logger from '../../config/logger';

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

async function handleStats(ctx: Context) {
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);

  try {
    const participant = await getParticipantByTelegramId(telegramId);
    if (!participant) {
      await ctx.reply('Please register first by sending /start');
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
      ? `\`${escapeMarkdownV2(activeLink.inviteLink)}\``
      : '_Use /mylink or tap button below to generate one_';

    const milestoneMsg =
      referralCount === 0
        ? '🎯 *Next Goal:* Get your first invite to appear on the leaderboard\\!'
        : referralCount < 5
        ? '📈 *Great start\\!* Keep inviting developers to climb higher\\!'
        : referralCount < 15
        ? "🔥 *You're on fire\\!* Top prize positions are within reach\\!"
        : '🏆 *Outstanding performance\\!* A true StarLift showcase champion\\!';

    const escapedName = escapeMarkdownV2(participant.firstName);
    const escapedCode = escapeMarkdownV2(participant.referralCode);

    const text =
      `📊 *StarLift Contestant Statistics*\n\n` +
      `👤 *Contestant:* ${escapedName}\n` +
      `🔑 *Referral Code:* \`${escapedCode}\`\n\n` +
      `👥 *Confirmed Referrals:* *${referralCount}* joins\n` +
      `❤️ *Project Reactions:* *${reactionCount}* reactions\n` +
      `🏅 *Current Standing:* *Rank #${rank}* of ${totalParticipants} contestants\n\n` +
      `📈 *Composite Score Breakdown:*\n` +
      `• 🤝 *Referral Score \\(70%\\):* \`${referralScore} / 70.0 pts\`\n` +
      `• ❤️ *Reaction Score \\(30%\\):* \`${reactionScore} / 30.0 pts\`\n` +
      `• 🎯 *Total Score:* *${finalScore} pts*\n\n` +
      `${milestoneMsg}\n\n` +
      `🔗 *Your Personal Link:*\n${linkText}`;

    await ctx.replyWithMarkdownV2(
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
