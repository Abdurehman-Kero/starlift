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
    const text =
      `<b>StarLift Competition Evaluation</b>\n\n` +
      `The official contestant standings and final project evaluations are tracked and managed directly by the NilePixel review committee on the administration portal.\n\n` +
      `<b>Challenge Period:</b> November 16 – November 30, 2026\n\n` +
      `Keep inviting members to @NilePixelTech using your personal link to strengthen your candidacy for the top 3 Upwork job contracts and 5-star reviews.\n\n` +
      `To view your confirmed referrals and invite link, tap <b>My Stats</b> below.`;

    await ctx.replyWithHTML(
      text,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('My Stats', 'cmd_stats'),
          Markup.button.callback('Get My Invite Link', 'cmd_mylink'),
        ],
        [
          Markup.button.url('Official Channel', 'https://t.me/NilePixelTech'),
          Markup.button.callback('Main Menu', 'cmd_start'),
        ],
      ])
    );
  } catch (error) {
    logger.error('Error in /leaderboard command', { error });
    await ctx.reply('An error occurred while loading this page. Please try again.');
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
