import { Router, Request, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  createOrUpdateSubmission,
  publishShowcaseToChannel,
  unpublishShowcaseFromChannel,
  getSubmissionByParticipantId,
  notifyContestantOfAdjustmentRequired,
} from '../services/showcase.service';
import { bot } from '../bot/bot';
import { prisma } from '../database/client';
import logger from '../config/logger';

const router = Router();

// GET /api/submissions/image/:fileId - Public image proxy for Telegram photos without exposing bot token
router.get('/image/:fileId', async (req: Request, res: Response): Promise<void> => {
  const { fileId } = req.params;
  try {
    const fileLink = await bot.telegram.getFileLink(fileId);
    const tgRes = await fetch(fileLink.href);
    if (!tgRes.ok) {
      res.status(404).json({ success: false, message: 'Image not found on Telegram' });
      return;
    }
    const contentType = tgRes.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await tgRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    logger.error('Failed to proxy Telegram photo:', { fileId, err });
    res.status(500).json({ success: false, message: 'Failed to retrieve image' });
  }
});

router.use(authMiddleware);

// GET /api/submissions/:participantId
router.get('/:participantId', async (req: AuthRequest, res: Response): Promise<void> => {
  const participantId = parseInt(req.params.participantId, 10);
  if (isNaN(participantId)) {
    res.status(400).json({ success: false, message: 'Invalid participant ID' });
    return;
  }

  const submission = await getSubmissionByParticipantId(participantId);
  res.json({ success: true, data: submission });
});

// POST /api/submissions/:participantId - Create or update project submission
router.post('/:participantId', async (req: AuthRequest, res: Response): Promise<void> => {
  const participantId = parseInt(req.params.participantId, 10);
  if (isNaN(participantId)) {
    res.status(400).json({ success: false, message: 'Invalid participant ID' });
    return;
  }

  const { projectTitle, projectUrl, description, imageUrl, status } = req.body as {
    projectTitle?: string;
    projectUrl?: string;
    description?: string;
    imageUrl?: string;
    status?: string;
  };

  if (!projectUrl || !description) {
    res.status(400).json({
      success: false,
      message: 'projectUrl and description are required',
    });
    return;
  }

  if (projectTitle && (projectTitle.trim().length < 2 || projectTitle.trim().length > 60)) {
    res.status(400).json({
      success: false,
      message: 'Project title must be between 2 and 60 characters',
    });
    return;
  }

  const trimmedUrl = projectUrl.trim();
  if (trimmedUrl.length < 8 || trimmedUrl.length > 250 || /\s/.test(trimmedUrl)) {
    res.status(400).json({
      success: false,
      message: 'Project URL must be a valid link between 8 and 250 characters without spaces',
    });
    return;
  }

  const trimmedDescription = description.trim();
  if (trimmedDescription.length < 20 || trimmedDescription.length > 400) {
    res.status(400).json({
      success: false,
      message: 'Description must be between 20 and 400 characters (1–3 sentences)',
    });
    return;
  }

  try {
    const submission = await createOrUpdateSubmission({
      participantId,
      projectTitle: projectTitle ? projectTitle.trim() : undefined,
      projectUrl: trimmedUrl,
      description: trimmedDescription,
      imageUrl: imageUrl || null,
      status: status ?? 'verified',
    });

    res.json({ success: true, data: submission });
  } catch (err: unknown) {
    logger.error('Failed to create/update project submission:', { err });
    const message = err instanceof Error ? err.message : 'Failed to save submission';
    res.status(500).json({ success: false, message });
  }
});

// POST /api/submissions/:id/publish - Publish showcase directly to Telegram Channel!
router.post('/:id/publish', async (req: AuthRequest, res: Response): Promise<void> => {
  const submissionId = parseInt(req.params.id, 10);
  if (isNaN(submissionId)) {
    res.status(400).json({ success: false, message: 'Invalid submission ID' });
    return;
  }

  try {
    const published = await publishShowcaseToChannel(submissionId, req.admin?.email);
    res.json({
      success: true,
      message: 'Showcase successfully published to Telegram channel and linked to contestant!',
      data: published,
    });
  } catch (err: unknown) {
    logger.error('Failed to publish showcase to channel:', { err });
    const message = err instanceof Error ? err.message : 'Failed to publish to channel';
    res.status(500).json({ success: false, message });
  }
});

// POST /api/submissions/:id/unpublish - Delete showcase post from channel and reset to pending
router.post('/:id/unpublish', async (req: AuthRequest, res: Response): Promise<void> => {
  const submissionId = parseInt(req.params.id, 10);
  if (isNaN(submissionId)) {
    res.status(400).json({ success: false, message: 'Invalid submission ID' });
    return;
  }

  try {
    const unpublished = await unpublishShowcaseFromChannel(submissionId, req.admin?.email);
    res.json({
      success: true,
      message: 'Showcase post deleted from Telegram channel and reset to draft/pending.',
      data: unpublished,
    });
  } catch (err: unknown) {
    logger.error('Failed to unpublish showcase from channel:', { err });
    const message = err instanceof Error ? err.message : 'Failed to unpublish from channel';
    res.status(500).json({ success: false, message });
  }
});

// PATCH /api/submissions/:id/status - Update submission status (verified, rejected, pending)
router.patch('/:id/status', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { status } = req.body as { status?: string };

  if (!status || !['pending', 'verified', 'approved', 'rejected'].includes(status)) {
    res.status(400).json({ success: false, message: 'Invalid status' });
    return;
  }

  // Find submission by submissionId OR participantId
  const submission = await prisma.projectSubmission.findFirst({
    where: {
      OR: [{ id }, { participantId: id }],
    },
  });

  if (!submission) {
    res.status(404).json({ success: false, message: 'Submission not found' });
    return;
  }

  // If rejected and was published, also remove from channel
  if (status === 'rejected') {
    if (submission.channelMessageId) {
      try {
        await unpublishShowcaseFromChannel(submission.id, req.admin?.email);
      } catch (unpubErr) {
        logger.warn('Failed to unpublish rejected submission from channel:', { unpubErr });
      }
    }
    // Notify contestant via DM to adjust specifications and resubmit
    try {
      await notifyContestantOfAdjustmentRequired(submission.id);
    } catch (notifyErr) {
      logger.warn('Failed to notify contestant of adjustment required:', { notifyErr });
    }
  }

  const updated = await prisma.projectSubmission.update({
    where: { id: submission.id },
    data: {
      status,
      verifiedAt: status !== 'pending' ? new Date() : null,
      verifiedBy: status !== 'pending' ? req.admin!.email : null,
    },
  });

  res.json({ success: true, data: updated });
});

// PATCH /api/submissions/:id/reactions - Set reaction count directly for a submission
router.patch('/:id/reactions', async (req: AuthRequest, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  const { reactionCount, source } = req.body as { reactionCount?: number; source?: string };

  if (reactionCount === undefined || typeof reactionCount !== 'number' || reactionCount < 0) {
    res.status(400).json({ success: false, message: 'Valid non-negative reactionCount is required' });
    return;
  }

  const submission = await prisma.projectSubmission.findFirst({
    where: {
      OR: [{ id }, { participantId: id }],
    },
    include: { participant: true },
  });

  if (!submission) {
    res.status(404).json({ success: false, message: 'Submission not found' });
    return;
  }

  const existingReactions = await prisma.projectReaction.findMany({
    where: {
      OR: [{ submissionId: submission.id }, { participantId: submission.participantId }],
    },
    orderBy: { updatedAt: 'desc' },
  });

  const reaction = existingReactions.length > 0
    ? await prisma.projectReaction.update({
        where: { id: existingReactions[0].id },
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount,
          source: source ?? 'manual_admin',
          recordedBy: req.admin!.email,
        },
      })
    : await prisma.projectReaction.create({
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
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
      participantId: submission.participantId,
      action: 'UPDATE_REACTION_COUNT',
      details: JSON.stringify({ submissionId: submission.id, reactionCount, source }),
    },
  });

  res.json({ success: true, data: reaction });
});

export default router;
