import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import {
  getSubmissionByParticipantId,
  createOrUpdateSubmission,
  notifyAdminsOfNewSubmission,
} from '../../services/showcase.service';
import { getActiveInviteLink } from '../../services/invitation.service';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface SubmissionSession {
  step: 'TITLE' | 'URL' | 'DESCRIPTION' | 'IMAGE' | 'CONFIRM';
  projectTitle?: string;
  projectUrl?: string;
  description?: string;
  imageUrl?: string | null;
}

// In-memory wizard sessions per Telegram user ID
export const userSessions = new Map<string, SubmissionSession>();

/**
 * Presents a clear summary review card and requires tapping [Submit Specification]
 */
async function renderReviewAndConfirm(
  ctx: Context,
  participantId: number,
  session: SubmissionSession
) {
  session.step = 'CONFIRM';

  const title = escapeHtml(session.projectTitle || 'My Project');
  const url = escapeHtml(session.projectUrl || '');
  const pitch = escapeHtml(session.description || '');
  const imageStatus = session.imageUrl
    ? 'Attached (screenshot/banner)'
    : 'None (text only)';

  const text =
    `<b>Review Your Project Specification</b>\n\n` +
    `• <b>Title:</b> ${title}\n` +
    `• <b>Demo / Portfolio:</b> <code>${url}</code>\n` +
    `• <b>Description:</b>\n${pitch}\n` +
    `• <b>Banner Image:</b> ${imageStatus}\n\n` +
    `Please check the details above. When ready, tap <b>Submit Specification</b> below to send your project for review.`;

  await ctx.replyWithHTML(
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback('Submit Specification', 'confirm_submit')],
      [
        Markup.button.callback('Start Over', 'cmd_update_submit'),
        Markup.button.callback('Cancel', 'cancel_submission'),
      ],
    ])
  );
}

/**
 * Finalizes the submission, saves to database, notifies contestant, and alerts administrator group
 */
async function finalizeSubmission(
  ctx: Context,
  participantId: number,
  session: SubmissionSession
) {
  const telegramIdStr = String(ctx.from!.id);
  userSessions.delete(telegramIdStr);

  const submission = await createOrUpdateSubmission({
    participantId,
    projectTitle: session.projectTitle || 'StarLift Showcase Project',
    projectUrl: session.projectUrl!,
    description: session.description!,
    imageUrl: session.imageUrl || null,
    status: 'pending',
  });

  // Alert Administrator Group
  try {
    await notifyAdminsOfNewSubmission(submission.id);
  } catch (adminAlertErr) {
    logger.warn('Failed to alert admins of new submission:', { adminAlertErr });
  }

  const title = escapeHtml(submission.projectTitle || 'Showcase Project');
  const activeLink = await getActiveInviteLink(participantId);
  const linkText = activeLink
    ? `<code>${escapeHtml(activeLink.inviteLink)}</code>`
    : `<i>Tap "Get Invite Link" below to generate your link</i>`;

  const bannerNotice = submission.imageUrl
    ? `• <b>Banner Image:</b> Attached\n`
    : `• <b>Banner Image:</b> Not attached (you can send a photo anytime to attach one)\n`;

  await ctx.replyWithHTML(
    `<b>Project Specification Submitted</b>\n\n` +
      `Your project <b>${title}</b> has been received and is now under review.\n\n` +
      `• <b>Status:</b> Under Review\n` +
      `${bannerNotice}\n` +
      `Our team will review your specification and feature it on @NilePixelTech.\n` +
      `If you have questions or need support, contact @NilePixelSupportBot.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Your Channel Invite Link is Ready:</b>\n` +
      `${linkText}\n\n` +
      `Share this link with your network to invite friends to @NilePixelTech. Every confirmed join boosts your rank on the leaderboard.`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('Get My Invite Link', 'cmd_mylink'),
        Markup.button.callback('My Stats & Rank', 'cmd_stats'),
      ],
      [
        Markup.button.callback('Leaderboard', 'cmd_leaderboard'),
        Markup.button.url('Official Channel', 'https://t.me/NilePixelTech'),
      ],
      [
        Markup.button.url('Contact Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
      ],
    ])
  );
}

/**
 * Starts the step-by-step submission questionnaire.
 * If already submitted and not an explicit update, notifies the user and offers an update button.
 */
export async function startSubmissionWizard(
  ctx: Context,
  participantId: number,
  initialImageUrl?: string,
  isExplicitUpdate?: boolean
) {
  const telegramIdStr = String(ctx.from!.id);

  if (!isExplicitUpdate) {
    const existing = await getSubmissionByParticipantId(participantId);
    if (existing) {
      const subTitle = escapeHtml(existing.projectTitle || 'Showcase Project');
      const subUrl = escapeHtml(existing.projectUrl);
      const statusText = existing.status.toUpperCase();

      await ctx.replyWithHTML(
        `<b>You Have Already Submitted</b>\n\n` +
          `You previously submitted your project specification:\n\n` +
          `• <b>Title:</b> ${subTitle}\n` +
          `• <b>Demo / Portfolio:</b> <code>${subUrl}</code>\n` +
          `• <b>Status:</b> ${statusText}\n\n` +
          `If you want to update your submission details, tap <b>Update Project Details</b> below.`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Update Project Details', 'cmd_update_submit')],
          [Markup.button.callback('My Stats & Rank', 'cmd_stats')],
          [Markup.button.callback('Main Menu', 'cmd_start')],
        ])
      );
      return;
    }
  }

  userSessions.set(telegramIdStr, {
    step: 'TITLE',
    imageUrl: initialImageUrl || null,
  });

  const photoNotice = initialImageUrl
    ? `<i>Your uploaded photo is saved and will be attached.</i>\n\n`
    : '';

  await ctx.replyWithHTML(
    `<b>Project Submission — Step 1 of 4: Title</b>\n\n` +
      `${photoNotice}` +
      `Please reply with your project title (or your name for a developer portfolio):\n` +
      `(e.g., <b>NilePay Gateway</b>)`,
    Markup.inlineKeyboard([
      [Markup.button.callback('Cancel', 'cancel_submission')],
    ])
  );
}

export function registerSubmitCommand(bot: Telegraf) {
  // 1. /submit command
  bot.command('submit', async (ctx: Context) => {
    if (!ctx.from) return;

    const telegramId = BigInt(ctx.from.id);

    try {
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant || !participant.isCompetitor) {
        await ctx.reply('Please register for the challenge first by sending /start.');
        return;
      }

      await startSubmissionWizard(ctx, participant.id);
    } catch (err) {
      logger.error('Error in /submit command:', { err });
      await ctx.reply('An error occurred. Please try again with /start.');
    }
  });

  // 2. Inline button cmd_submit
  bot.action('cmd_submit', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      await ctx.answerCbQuery();
      const telegramId = BigInt(ctx.from.id);
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant) {
        await ctx.reply('Please send /start to register first.');
        return;
      }

      await startSubmissionWizard(ctx, participant.id);
    } catch (err) {
      logger.error('Error in cmd_submit callback:', { err });
    }
  });

  // 3. Inline button cmd_update_submit (explicit re-submission)
  bot.action('cmd_update_submit', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      await ctx.answerCbQuery('Starting update…');
      const telegramId = BigInt(ctx.from.id);
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant) return;

      await startSubmissionWizard(ctx, participant.id, undefined, true);
    } catch (err) {
      logger.error('Error in cmd_update_submit callback:', { err });
    }
  });

  // 4. Confirm submission button
  bot.action('confirm_submit', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      const telegramIdStr = String(ctx.from.id);
      const session = userSessions.get(telegramIdStr);

      if (!session || !session.projectUrl || !session.description) {
        await ctx.answerCbQuery('Session expired. Please restart with /submit.');
        return;
      }

      await ctx.answerCbQuery('Submitting project specification…');
      const telegramId = BigInt(ctx.from.id);
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant) return;

      await finalizeSubmission(ctx, participant.id, session);
    } catch (err) {
      logger.error('Error in confirm_submit callback:', { err });
    }
  });

  // 5. Skip image in Step 4
  bot.action('skip_submission_image', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      await ctx.answerCbQuery('Proceeding without image…');
      const telegramIdStr = String(ctx.from.id);
      const session = userSessions.get(telegramIdStr);

      if (!session || !session.projectUrl || !session.description) {
        await ctx.reply('No active submission found. Please send /submit to begin.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant) return;

      session.imageUrl = null;
      await renderReviewAndConfirm(ctx, participant.id, session);
    } catch (err) {
      logger.error('Error in skip_submission_image callback:', { err });
    }
  });

  // 6. Cancel submission
  bot.action('cancel_submission', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      await ctx.answerCbQuery('Submission cancelled.');
      const telegramIdStr = String(ctx.from.id);
      userSessions.delete(telegramIdStr);
      await ctx.reply('Project submission cancelled. You can start anytime with /submit or /start.');
    } catch (err) {
      logger.error('Error in cancel_submission callback:', { err });
    }
  });

  // 7. Text input listener for wizard steps
  bot.on('text', async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return next();

    const telegramIdStr = String(ctx.from.id);
    const text = ctx.message.text.trim();

    // If text is another command, clear wizard session and let other handlers run
    if (text.startsWith('/') && !text.startsWith('/submit')) {
      if (userSessions.has(telegramIdStr)) {
        userSessions.delete(telegramIdStr);
      }
      return next();
    }

    const session = userSessions.get(telegramIdStr);
    if (!session) return next();

    const telegramId = BigInt(ctx.from.id);
    const participant = await getParticipantByTelegramId(telegramId);
    if (!participant) return next();

    // STEP 1: Project Title
    if (session.step === 'TITLE') {
      if (text.length < 2) {
        await ctx.reply('Please provide a valid project title:');
        return;
      }

      session.projectTitle = text;
      session.step = 'URL';

      await ctx.replyWithHTML(
        `<b>Project Title Saved:</b> <b>${escapeHtml(session.projectTitle)}</b>\n\n` +
          `<b>Step 2 of 4: Demo / Portfolio Link</b>\n` +
          `Please send your live website link, GitHub repository, or portfolio URL:\n` +
          `(e.g., <code>https://nilepay.et</code> or <code>https://github.com/...</code>)`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 2: Demo / Portfolio URL
    if (session.step === 'URL') {
      let url = text;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.')) url = `https://${url}`;
      }

      if (!url.startsWith('http')) {
        await ctx.replyWithHTML(
          'Please send a valid link starting with <code>https://</code> or <code>http://</code> (e.g. <code>https://yourdemo.com</code>):'
        );
        return;
      }

      session.projectUrl = url;
      session.step = 'DESCRIPTION';

      await ctx.replyWithHTML(
        `<b>Demo URL Saved:</b> <code>${escapeHtml(session.projectUrl)}</code>\n\n` +
          `<b>Step 3 of 4: Short Pitch / Description</b>\n` +
          `Please write a short description (1–3 sentences) explaining what your project does:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 3: Description / Pitch
    if (session.step === 'DESCRIPTION') {
      if (text.length < 5) {
        await ctx.reply('Please provide a short description of at least a few words:');
        return;
      }

      session.description = text;

      if (session.imageUrl) {
        await renderReviewAndConfirm(ctx, participant.id, session);
        return;
      }

      session.step = 'IMAGE';

      await ctx.replyWithHTML(
        `<b>Description Saved.</b>\n\n` +
          `<b>Step 4 of 4: Project Screenshot or Banner</b>\n` +
          `<i>(Strongly recommended — projects with an image receive significantly higher community votes)</i>\n\n` +
          `Please send a screenshot or banner photo of your project now, or tap <b>Skip Image</b> to proceed without one:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Skip Image', 'skip_submission_image')],
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 4: Image URL via text
    if (session.step === 'IMAGE') {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        session.imageUrl = text;
        await renderReviewAndConfirm(ctx, participant.id, session);
        return;
      }

      await ctx.replyWithHTML(
        `Please send an image photo or link starting with <code>https://</code>, or tap <b>Skip Image</b>:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Skip Image', 'skip_submission_image')],
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    return next();
  });

  // 8. Photo listener
  bot.on('photo', async (ctx: Context) => {
    if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;

    const telegramId = BigInt(ctx.from.id);
    const telegramIdStr = String(ctx.from.id);

    try {
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant || !participant.isCompetitor) {
        await ctx.reply('Please register for the challenge first by sending /start.');
        return;
      }

      const photos = ctx.message.photo;
      const bestPhoto = photos[photos.length - 1];
      const fileId = bestPhoto.file_id;

      const session = userSessions.get(telegramIdStr);
      if (session) {
        session.imageUrl = fileId;

        if (session.step === 'IMAGE' && session.projectUrl && session.description) {
          await renderReviewAndConfirm(ctx, participant.id, session);
          return;
        }

        await ctx.replyWithHTML(
          `<b>Banner Photo Attached.</b>\nPlease continue with the current step above.`
        );
        return;
      }

      // If user already has an existing submission and uploads a photo:
      const existing = await getSubmissionByParticipantId(participant.id);
      if (existing) {
        const updated = await createOrUpdateSubmission({
          participantId: participant.id,
          projectUrl: existing.projectUrl,
          description: existing.description,
          imageUrl: fileId,
        });

        try {
          await notifyAdminsOfNewSubmission(updated.id);
        } catch (alertErr) {
          logger.warn('Failed to alert admins of updated photo:', { alertErr });
        }

        await ctx.replyWithHTML(
          `<b>Banner Photo Updated</b>\n\n` +
            `Your photo has been attached to your project <b>${escapeHtml(existing.projectTitle || 'Showcase Project')}</b>.\n\n` +
            `Our team in the Administrator Group will use this image when featuring your project on @NilePixelTech.`
        );
        return;
      }

      await startSubmissionWizard(ctx, participant.id, fileId);
    } catch (err) {
      logger.error('Error handling photo message:', { err });
      await ctx.reply('An error occurred while processing the photo. Please try again.');
    }
  });
}
