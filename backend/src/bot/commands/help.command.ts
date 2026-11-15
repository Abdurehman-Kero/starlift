import { Context, Markup, Telegraf } from 'telegraf';
import logger from '../../config/logger';

async function handleHelp(ctx: Context) {
  try {
    await ctx.replyWithMarkdownV2(
      `ℹ️ *NilePixel StarLift — Challenge Guide & Rules*\n\n` +
        `🌟 *Event:* NilePixel StarLift Project Showcase Challenge\n` +
        `📅 *Timeline:* November 15 – November 30, 2026\n` +
        `📢 *Target Channel:* @NilePixelTech\n\n` +
        `*Available Commands:*\n` +
        `/start \\- Register and view your referral code\n` +
        `/mylink \\- Get your personal channel invite link\n` +
        `/stats \\- Check your live referrals, points & rank\n` +
        `/leaderboard \\- See top 10 competition standings\n` +
        `/help \\- Show this guide and scoring rules\n\n` +
        `*How Scoring Works \\(70/30 Formula\\):*\n` +
        `Your final score \\(0 – 100 pts\\) is computed dynamically:\n` +
        `1\\. 🤝 *Referrals \\(70%\\):* Points based on verified channel joins via your /mylink\\.\n` +
        `   \`(Your Referrals / Top Referrals) × 100 × 0.70\`\n` +
        `2\\. ❤️ *Reactions \\(30%\\):* Points from Telegram reactions on your showcased project post in the channel\\.\n` +
        `   \`(Your Reactions / Top Reactions) × 100 × 0.30\`\n\n` +
        `*How to Participate:*\n` +
        `1\\. Send /mylink to receive your personal channel invite link\\.\n` +
        `2\\. Share your link with friends, groups, and developers\\.\n` +
        `3\\. When they join @NilePixelTech, you are credited automatically\\!\n` +
        `4\\. Top 3 contestants win the StarLift Project Showcase prizes\\!\n\n` +
        `🛡️ *Fair Play Rules:*\n` +
        `• Only genuine members joining via your personal link are credited\\.\n` +
        `• If an invited member leaves the channel, the referral is revoked\\.\n` +
        `• Self\\-referrals and fake bot accounts are automatically disqualified\\.\n\n` +
        `💬 *Support & Project Submissions:*\n` +
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
