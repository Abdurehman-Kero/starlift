import { Context, Markup, Telegraf } from 'telegraf';
import { calculateScores } from '../../services/scoring.service';
import logger from '../../config/logger';

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

const MEDALS = ['🥇', '🥈', '🥉'];

async function handleLeaderboard(ctx: Context) {
  try {
    const scores = await calculateScores();
    const top10 = scores.slice(0, 10);

    if (top10.length === 0) {
      await ctx.reply(
        '🌟 No participants ranked on the leaderboard yet.\n\n' +
          'Be the first! Use /mylink to invite friends and claim the #1 spot.'
      );
      return;
    }

    const lines = top10.map((entry) => {
      const medal = MEDALS[entry.rank - 1] ?? `*#${entry.rank}*`;
      const name = escapeMarkdownV2(
        entry.username ? `@${entry.username}` : entry.firstName
      );
      const points = entry.finalScore.toFixed(1);
      return `${medal} ${name} \\— *${entry.referralCount}* refs \\(\`${points} pts\`\\)`;
    });

    const header =
      `🏆 *StarLift Competition Leaderboard*\n` +
      `_Top 10 Contestants \\(70% Referrals \\+ 30% Reactions\\)_\n\n` +
      lines.join('\n') +
      `\n\n⏳ *Challenge Deadline:* November 30, 2026\n` +
      `_Rankings update live as members join through personal links\\._`;

    await ctx.replyWithMarkdownV2(
      header,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
          Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
        ],
        [
          Markup.button.callback('🔄 Refresh Leaderboard', 'cmd_leaderboard'),
          Markup.button.callback('🏠 Main Menu', 'cmd_start'),
        ],
      ])
    );
  } catch (error) {
    logger.error('Error in /leaderboard command', { error });
    await ctx.reply('An error occurred while loading the leaderboard. Please try again.');
  }
}

export function registerLeaderboardCommand(bot: Telegraf) {
  bot.command('leaderboard', async (ctx: Context) => {
    await handleLeaderboard(ctx);
  });

  bot.action('cmd_leaderboard', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery('Refreshing leaderboard…');
      await handleLeaderboard(ctx);
    } catch (err) {
      logger.error('Error in cmd_leaderboard callback', { err });
    }
  });
}
