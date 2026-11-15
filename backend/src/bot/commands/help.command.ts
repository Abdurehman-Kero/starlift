import { Context, Markup, Telegraf } from 'telegraf';
import logger from '../../config/logger';

async function handleHelp(ctx: Context) {
  try {
    await ctx.replyWithHTML(
      `ℹ️ <b>NilePixel StarLift — Challenge Guide & Rules</b>\n\n` +
        `🌟 <b>Event:</b> NilePixel StarLift Project Showcase Challenge\n` +
        `📅 <b>Timeline:</b> November 15 – November 30, 2026\n` +
        `📢 <b>Target Channel:</b> @NilePixelTech\n\n` +
        `<b>Available Commands:</b>\n` +
        `/start - Register and view your referral code\n` +
        `/mylink - Get your personal channel invite link\n` +
        `/stats - Check your live referrals, points & rank\n` +
        `/leaderboard - See top 10 competition standings\n` +
        `/help - Show this guide and scoring rules\n\n` +
        `<b>How Scoring Works (70/30 Formula):</b>\n` +
        `Your final score (0 – 100 pts) is computed dynamically:\n` +
        `1. 🤝 <b>Referrals (70%):</b> Points based on verified channel joins via your /mylink.\n` +
        `   <code>(Your Referrals / Top Referrals) × 100 × 0.70</code>\n` +
        `2. ❤️ <b>Reactions (30%):</b> Points from Telegram reactions on your showcased project post in the channel.\n` +
        `   <code>(Your Reactions / Top Reactions) × 100 × 0.30</code>\n\n` +
        `<b>How to Participate:</b>\n` +
        `1. Send /mylink to receive your personal channel invite link.\n` +
        `2. Share your link with friends, groups, and developers.\n` +
        `3. When they join @NilePixelTech, you are credited automatically!\n` +
        `4. Top 3 contestants win the StarLift Project Showcase prizes!\n\n` +
        `🛡️ <b>Fair Play Rules:</b>\n` +
        `• Only genuine members joining via your personal link are credited.\n` +
        `• If an invited member leaves the channel, the referral is revoked.\n` +
        `• Self-referrals and fake bot accounts are automatically disqualified.\n\n` +
        `💬 <b>Support & Project Submissions:</b>\n` +
        `• Project submissions & questions: @NilePixelSupportBot\n` +
        `• Official Announcements: @NilePixelTech`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
          Markup.button.callback('📊 My Stats', 'cmd_stats'),
        ],
        [
          Markup.button.url('📢 Official Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
          Markup.button.url('💬 Support Bot (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
        ],
        [
          Markup.button.callback('🏠 Main Menu', 'cmd_start'),
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
