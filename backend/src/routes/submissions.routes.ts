import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  createOrUpdateSubmission,
  publishShowcaseToChannel,
  unpublishShowcaseFromChannel,
  getSubmissionByParticipantId,
} from '../services/showcase.service';
import { prisma } from '../database/client';
import logger from '../config/logger';

const router = Router();

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

  try {
    const submission = await createOrUpdateSubmission({
      participantId,
      projectTitle,
      projectUrl,
      description,
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
  if (status === 'rejected' && submission.channelMessageId) {
    try {
      await unpublishShowcaseFromChannel(submission.id, req.admin?.email);
    } catch (unpubErr) {
      logger.warn('Failed to unpublish rejected submission from channel:', { unpubErr });
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

export default router;
