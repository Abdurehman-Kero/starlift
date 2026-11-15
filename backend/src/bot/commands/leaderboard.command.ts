import { Context, Markup, Telegraf } from 'telegraf';
import { calculateScores } from '../../services/scoring.service';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const MEDALS = ['#1', '#2', '#3'];

async function handleLeaderboard(ctx: Context) {
  try {
    const scores = await calculateScores();
    const top10 = scores.slice(0, 10);

    if (top10.length === 0) {
      await ctx.reply(
        'No participants ranked on the leaderboard yet.\n\n' +
          'Be the first! Use /mylink to invite friends and claim the top spot.'
      );
      return;
    }

    const lines = top10.map((entry) => {
      const rankTag = MEDALS[entry.rank - 1] ?? `#${entry.rank}`;
      const name = escapeHtml(
        entry.username ? `@${entry.username}` : entry.firstName
      );
      const points = entry.finalScore.toFixed(1);
      return `<b>${rankTag}</b> ${name} — <b>${entry.referralCount}</b> referrals, <b>${entry.reactionCount}</b> reactions (<code>${points} pts</code>)`;
    });

    const header =
      `<b>StarLift Competition Leaderboard</b>\n` +
      `<i>Top 10 Contestants</i>\n\n` +
      lines.join('\n') +
      `\n\n<b>Challenge Deadline:</b> November 30, 2026\n` +
      `<i>Rankings update automatically based on verified joins and reactions.</i>`;

    await ctx.replyWithHTML(
      header,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('My Stats & Rank', 'cmd_stats'),
          Markup.button.callback('Get My Invite Link', 'cmd_mylink'),
        ],
        [
          Markup.button.callback('Refresh Leaderboard', 'cmd_leaderboard'),
          Markup.button.callback('Main Menu', 'cmd_start'),
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
