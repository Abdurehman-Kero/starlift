import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../database/client';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, action, participantId } = req.query as Record<string, string>;

  const pageNum = page ? parseInt(page, 10) : 1;
  const limitNum = limit ? parseInt(limit, 10) : 50;
  const skip = (pageNum - 1) * limitNum;

  const where = {
    ...(action ? { action } : {}),
    ...(participantId ? { participantId: parseInt(participantId, 10) } : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: 'desc' },
      include: {
        participant: { select: { id: true, username: true, firstName: true } },
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  res.json({
    success: true,
    data: { logs, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) },
  });
});

export default router;
