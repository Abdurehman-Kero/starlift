import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth.middleware';
import {
  createOrUpdateSubmission,
  publishShowcaseToChannel,
  getSubmissionByParticipantId,
} from '../services/showcase.service';
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

  const { projectTitle, projectUrl, description, status } = req.body as {
    projectTitle?: string;
    projectUrl?: string;
    description?: string;
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

export default router;
