import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  listParticipants,
  getParticipantByTelegramId,
} from '../services/participant.service';
import { prisma } from '../database/client';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { page, limit, search, sortBy, sortOrder } = req.query as Record<string, string>;

  const result = await listParticipants({
    page: page ? parseInt(page, 10) : 1,
    limit: limit ? parseInt(limit, 10) : 20,
    search,
    sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  });

  res.json({ success: true, data: result });
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ success: false, message: 'Invalid participant ID' });
    return;
  }

  const participant = await prisma.participant.findUnique({
    where: { id },
    include: {
      invitationLinks: true,
      referralsMade: { include: { referred: true }, orderBy: { createdAt: 'desc' } },
      referralReceived: { include: { referrer: true } },
      projectSubmission: true,
      reactions: true,
    },
  });

  if (!participant) {
    res.status(404).json({ success: false, message: 'Participant not found' });
    return;
  }

  res.json({ success: true, data: participant });
});

router.patch(
  '/:id/verify-submission',
  async (req: AuthRequest, res: Response): Promise<void> => {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body as { status?: string };

    if (!status || !['pending', 'verified', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const submission = await prisma.projectSubmission.findUnique({
      where: { participantId: id },
    });

    if (!submission) {
      res.status(404).json({ success: false, message: 'Submission not found' });
      return;
    }

    const updated = await prisma.projectSubmission.update({
      where: { participantId: id },
      data: {
        status,
        verifiedAt: status !== 'pending' ? new Date() : null,
        verifiedBy: status !== 'pending' ? req.admin!.email : null,
      },
    });

    await prisma.activityLog.create({
      data: {
        adminEmail: req.admin!.email,
        action: 'VERIFY_SUBMISSION',
        details: JSON.stringify({ participantId: id, status }),
      },
    });

    res.json({ success: true, data: updated });
  }
);

export default router;
