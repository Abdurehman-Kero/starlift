import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { getSettings, updateSetting } from '../services/settings.service';
import { syncBotProfileToTelegram } from '../services/botProfile.service';
import { bot, isBotRunning } from '../bot/bot';
import { isBotConfigured } from '../config/env';

const router = Router();

router.use(authMiddleware);

router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const settings = await getSettings();
  res.json({ success: true, data: settings });
});

router.put('/:key', async (req: AuthRequest, res: Response): Promise<void> => {
  const { key } = req.params;
  const { value } = req.body as { value?: string };

  if (value === undefined) {
    res.status(400).json({ success: false, message: 'value is required' });
    return;
  }

  const setting = await updateSetting(key, String(value), req.admin!.email);
  res.json({ success: true, data: setting });
});

// Endpoint to sync bot commands, description, and profile to Telegram API
router.post('/sync-bot-profile', async (_req: AuthRequest, res: Response): Promise<void> => {
  if (!isBotConfigured()) {
    res.status(400).json({
      success: false,
      message: 'BOT_TOKEN is not configured in environment variables.',
    });
    return;
  }

  try {
    const syncResult = await syncBotProfileToTelegram(bot);
    res.json({
      success: true,
      message: 'Bot profile, commands, and descriptions synchronized with Telegram.',
      data: syncResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to sync with Telegram';
    res.status(500).json({ success: false, message });
  }
});

export default router;
