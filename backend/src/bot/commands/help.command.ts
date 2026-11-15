import { Context, Markup, Telegraf } from 'telegraf';
import logger from '../../config/logger';

async function handleHelp(ctx: Context) {
  try {
    await ctx.replyWithHTML(
      `<b>NilePixel StarLift — Challenge Guide</b>\n\n` +
        `• <b>Challenge:</b> Upwork First Job Challenge\n` +
        `• <b>Period:</b> November 16 – November 30, 2026\n` +
        `• <b>Official Channel:</b> @NilePixelTech\n\n` +
        `<b>Commands:</b>\n` +
        `/start - Open the main menu\n` +
        `/submit - Submit or update your project specification\n` +
        `/mylink - View your personal channel invitation link\n` +
        `/stats - Check your referrals, reactions, points & rank\n` +
        `/leaderboard - View the top 10 contestants\n` +
        `/help - Show this guide\n\n` +
        `<b>How to Compete:</b>\n` +
        `1. Submit your project or developer portfolio specification via /submit.\n` +
        `2. Once approved, your project card is featured on @NilePixelTech.\n` +
        `3. Share your personal invite link from /mylink to invite friends.\n` +
        `4. Top 3 contestants win the Upwork first job contracts and 5-star reviews from NilePixel Technologies.\n\n` +
        `<b>Fair Play:</b>\n` +
        `• Only genuine members joining via your personal link are credited.\n` +
        `• If an invited member leaves the channel, the referral is revoked.\n` +
        `• Self-referrals and fake bot accounts are disqualified.\n\n` +
        `• <b>Official Channel:</b> @NilePixelTech\n` +
        `• <b>Support & Questions:</b> @NilePixelSupportBot`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('Submit Project', 'cmd_submit'),
          Markup.button.callback('Get Invite Link', 'cmd_mylink'),
        ],
        [
          Markup.button.callback('My Stats & Rank', 'cmd_stats'),
          Markup.button.callback('Leaderboard', 'cmd_leaderboard'),
        ],
        [
          Markup.button.url('Official Channel', 'https://t.me/NilePixelTech'),
          Markup.button.url('Contact Support', 'https://t.me/NilePixelSupportBot'),
        ],
        [
          Markup.button.callback('Main Menu', 'cmd_start'),
        ],
      ])
    );
  } catch (error) {
    logger.error('Error in /help command', { error });
    await ctx.reply('An error occurred while loading the guide. Please try again.');
  }
}

export function registerHelpCommand(bot: Telegraf) {
  bot.command('help', async (ctx: Context) => {
    await handleHelp(ctx);
  });

  bot.action('cmd_help', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      await handleHelp(ctx);
    } catch (err) {
      logger.error('Error in cmd_help callback', { err });
    }
  });
}
