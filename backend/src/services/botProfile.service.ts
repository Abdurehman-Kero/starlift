import { Telegraf } from 'telegraf';
import logger from '../config/logger';
import { getSetting } from './settings.service';

export const DEFAULT_BOT_DESCRIPTION =
  '🌟 NilePixel StarLift Project Showcase\n\n' +
  'Official tracking bot for the StarLift Challenge (Nov 15 – 30, 2026) by NilePixel Technologies.\n\n' +
  '🚀 Key Capabilities:\n' +
  '• 🔗 Generate your personal channel invite link\n' +
  '• 👥 Track friends joining @NilePixelTech automatically\n' +
  '• ⚖️ 70/30 Scoring: 70% referrals + 30% project reactions\n' +
  '• 🏆 Live competition rankings & score breakdown\n\n' +
  'Tap "Start" below to register and get your invite link!';

export const DEFAULT_BOT_SHORT_DESCRIPTION =
  'Official referral & leaderboard bot for NilePixel StarLift Project Showcase Challenge (Nov 15–30, 2026).';

export const BOT_COMMANDS = [
  { command: 'start', description: '🚀 Register & open main menu' },
  { command: 'mylink', description: '🔗 Get your personal channel invite link' },
  { command: 'stats', description: '📊 Check your referrals, points & rank' },
  { command: 'leaderboard', description: '🏆 View top 10 competition standings' },
  { command: 'help', description: 'ℹ️ Scoring guide, rules & support' },
];

/**
 * Synchronizes the bot profile, descriptions, and command menu with Telegram's official API
 */
export async function syncBotProfileToTelegram(bot: Telegraf): Promise<{
  commands: boolean;
  description: boolean;
  shortDescription: boolean;
  name: boolean;
}> {
  const result = {
    commands: false,
    description: false,
    shortDescription: false,
    name: false,
  };

  try {
    // 1. Set Menu Commands in Telegram client
    await bot.telegram.setMyCommands(BOT_COMMANDS);
    result.commands = true;
    logger.info('Telegram menu commands registered successfully');
  } catch (err) {
    logger.warn('Failed to set Telegram menu commands:', { err });
  }

  try {
    // 2. Fetch custom description from DB or fallback
    let customDesc: string | null = null;
    try {
      customDesc = await getSetting('BOT_DESCRIPTION');
    } catch {
      // fallback if DB not yet loaded
    }
    const descText = (customDesc || DEFAULT_BOT_DESCRIPTION).trim();

    await bot.telegram.setMyDescription(descText);
    result.description = true;
    logger.info('Telegram bot description set successfully');
  } catch (err) {
    logger.warn('Failed to set Telegram bot description:', { err });
  }

  try {
    // 3. Fetch custom short description from DB or fallback
    let customShort: string | null = null;
    try {
      customShort = await getSetting('BOT_SHORT_DESCRIPTION');
    } catch {
      // fallback if DB not yet loaded
    }
    const shortText = (customShort || DEFAULT_BOT_SHORT_DESCRIPTION).trim();

    await bot.telegram.setMyShortDescription(shortText);
    result.shortDescription = true;
    logger.info('Telegram bot short description set successfully');
  } catch (err) {
    logger.warn('Failed to set Telegram bot short description:', { err });
  }

  try {
    // 4. Set Bot Name if supported
    if (typeof (bot.telegram as any).setMyName === 'function') {
      await (bot.telegram as any).setMyName('NilePixel StarLift');
      result.name = true;
    }
  } catch (err) {
    // Non-critical, some bot tokens don't support setMyName
    logger.debug('setMyName notice (non-fatal):', { err });
  }

  return result;
}
