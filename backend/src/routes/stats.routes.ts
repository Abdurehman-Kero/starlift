import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { getOverviewStats, getDailyStats } from '../services/stats.service';

const router = Router();

router.use(authMiddleware);

router.get('/overview', async (_req: AuthRequest, res: Response): Promise<void> => {
  const stats = await getOverviewStats();
  res.json({ success: true, data: stats });
});

router.get('/daily', async (req: AuthRequest, res: Response): Promise<void> => {
  const { days } = req.query as { days?: string };
  const daysNum = days ? parseInt(days, 10) : 7;
  const stats = await getDailyStats(daysNum);
  res.json({ success: true, data: stats });
});

export default router;
