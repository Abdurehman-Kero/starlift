import { Telegraf } from 'telegraf';
import logger from '../config/logger';
import { getSetting } from './settings.service';

export const DEFAULT_BOT_DESCRIPTION =
  '🌟 Welcome to NilePixel StarLift!\n\n' +
  'Join the official StarLift Project Showcase Challenge (Nov 15 – Nov 30, 2026) by NilePixel Technologies.\n\n' +
  '🚀 What this bot does:\n' +
  '• Generate your unique channel invitation link\n' +
  '• Automatically tracks friends who join @NilePixelTech\n' +
  '• Dynamic 70/30 scoring (70% referrals + 30% project reactions)\n' +
  '• Live competition leaderboard & statistics\n\n' +
  'Tap "Start" below to get your personal referral code and invite link!';

export const DEFAULT_BOT_SHORT_DESCRIPTION =
  'Official referral & leaderboard bot for the NilePixel StarLift Project Showcase Challenge (Nov 15–30, 2026).';

export const BOT_COMMANDS = [
  { command: 'start', description: '🚀 Register & view challenge status' },
  { command: 'mylink', description: '🔗 Get your personal channel invite link' },
  { command: 'stats', description: '📊 Check your referrals, points & rank' },
  { command: 'leaderboard', description: '🏆 Top 10 competition standings' },
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
    const customDesc = await getSetting('BOT_DESCRIPTION');
    const descText = (customDesc || DEFAULT_BOT_DESCRIPTION).trim();

    await bot.telegram.setMyDescription(descText);
    result.description = true;
    logger.info('Telegram bot description set successfully');
  } catch (err) {
    logger.warn('Failed to set Telegram bot description:', { err });
  }

  try {
    // 3. Fetch custom short description from DB or fallback
    const customShort = await getSetting('BOT_SHORT_DESCRIPTION');
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

