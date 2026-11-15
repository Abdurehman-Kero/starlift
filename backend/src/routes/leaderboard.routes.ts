import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import { calculateScores } from '../services/scoring.service';
import { prisma } from '../database/client';

const router = Router();

// Public endpoint
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  const scores = await calculateScores();
  res.json({ success: true, data: scores });
});

// Protected: upsert reaction count
router.patch(
  '/:participantId/reactions',
  authMiddleware,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const participantId = parseInt(req.params.participantId, 10);
    const { reactionCount, source } = req.body as {
      reactionCount?: number;
      source?: string;
    };

    if (reactionCount === undefined || typeof reactionCount !== 'number') {
      res.status(400).json({ success: false, message: 'reactionCount (number) is required' });
      return;
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      include: { projectSubmission: true },
    });

    if (!participant) {
      res.status(404).json({ success: false, message: 'Participant not found' });
      return;
    }

    let submission = participant.projectSubmission;
    if (!submission) {
      submission = await prisma.projectSubmission.create({
        data: {
          participantId: participant.id,
          projectUrl: 'https://t.me/NilePixelTech',
          description: 'Official StarLift showcase project',
          status: 'verified',
        },
      });
    }

    const existingReactions = await prisma.projectReaction.findMany({
      where: {
        OR: [
          { submissionId: submission.id },
          { participantId: participant.id },
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    const reaction = existingReactions.length > 0
      ? await prisma.projectReaction.update({
          where: { id: existingReactions[0].id },
          data: {
            submissionId: submission.id,
            participantId: participant.id,
            reactionCount,
            source: source ?? 'manual_admin',
            recordedBy: req.admin!.email,
          },
        })
      : await prisma.projectReaction.create({
          data: {
            submissionId: submission.id,
            participantId: participant.id,
            reactionCount,
            source: source ?? 'manual_admin',
            recordedBy: req.admin!.email,
          },
        });

    if (existingReactions.length > 1) {
      const extraIds = existingReactions.slice(1).map((r) => r.id);
      await prisma.projectReaction.deleteMany({
        where: { id: { in: extraIds } },
      });
    }

    await prisma.activityLog.create({
      data: {
        adminEmail: req.admin!.email,
        participantId,
        action: 'UPDATE_REACTION_COUNT',
        details: JSON.stringify({ reactionCount, source }),
      },
    });

    res.json({ success: true, data: reaction });
  }
);

export default router;
