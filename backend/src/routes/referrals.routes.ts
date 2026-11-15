import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { listReferrals, updateReferralStatus } from '../services/referral.service';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, referrerId, status } = req.query as Record<string, string>;

  const result = await listReferrals({
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
    referrerId: referrerId ? parseInt(referrerId, 10) : undefined,
    status,
  });

  res.json({ success: true, data: result });
});

router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status?: string };

  if (!status || !['confirmed', 'pending', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status value' });
    return;
  }

  try {
    const referral = await updateReferralStatus(id, status, req.admin!.email);
    res.json({ success: true, data: referral });
  } catch {
    res.status(404).json({ success: false, message: 'Referral not found' });
  }
});

export default router;
