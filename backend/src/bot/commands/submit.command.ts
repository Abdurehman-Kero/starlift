import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import {
  getSubmissionByParticipantId,
  createOrUpdateSubmission,
  notifyAdminsOfNewSubmission,
} from '../../services/showcase.service';
import { getActiveInviteLink, getOrCreateParticipantInviteLink } from '../../services/invitation.service';
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
  const participant = await getParticipantByTelegramId(BigInt(ctx.from!.id));
  const referralCode = participant?.referralCode || '';
  const inviteRecord = await getOrCreateParticipantInviteLink(participantId, referralCode);
  const inviteLink = inviteRecord?.inviteLink;

  const linkText = inviteLink
    ? `<code>${escapeHtml(inviteLink)}</code>`
    : `<i>Your invite link is being generated... Tap "My Stats" below to view it.</i>`;

  const bannerNotice = submission.imageUrl
    ? `• <b>Banner Image:</b> Attached\n`
    : `• <b>Banner Image:</b> Not attached (you can send a photo anytime to attach one)\n`;

  const shareText = encodeURIComponent(
    `Support my project "${submission.projectTitle || 'StarLift Project'}" in the NilePixel StarLift Challenge!\n\n` +
      `Join @NilePixelTech using my invite link:\n${inviteLink || ''}`
  );
  const shareUrl = inviteLink
    ? `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${shareText}`
    : 'https://t.me/NilePixelTech';

  await ctx.replyWithHTML(
    `<b>Project Specification Submitted</b>\n\n` +
      `Your project <b>${title}</b> has been received and is now under review.\n\n` +
      `• <b>Status:</b> Under Review\n` +
      `${bannerNotice}\n` +
      `Our team will review your project and feature it on @NilePixelTech shortly. Once published, you will receive a direct notification with your showcase post link right here.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Your Channel Invite Link is Ready:</b>\n` +
      `${linkText}\n\n` +
      `• <b>Referral Code:</b> <code>${escapeHtml(referralCode)}</code>\n\n` +
      `<b>Recommended Immediate Actions to Win:</b>\n\n` +
      `1. <b>Share with your community:</b>\n` +
      `Share your personal invite link in your developer channels, tech groups, and with any community that supports your work.\n\n` +
      `2. <b>Get community members to join:</b>\n` +
      `Every member who joins @NilePixelTech through your invite link is credited directly to you, boosting your score to win the challenge.\n\n` +
      `3. <b>Rally reactions once live:</b>\n` +
      `As soon as your showcase post is published on the channel, ask your community to react with emojis to your post.\n\n` +
      `4. <b>Track your stats:</b>\n` +
      `Tap <b>My Stats</b> below anytime to check your confirmed joins in real time.`,
    Markup.inlineKeyboard([
      [
        ...(inviteLink ? [Markup.button.url('Share with Community', shareUrl)] : []),
        Markup.button.callback('My Stats', 'cmd_stats'),
      ],
      [
        Markup.button.url('Official Channel', 'https://t.me/NilePixelTech'),
        Markup.button.url('Contact Support', 'https://t.me/NilePixelSupportBot'),
      ],
      [
        Markup.button.callback('Main Menu', 'cmd_start'),
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
          [Markup.button.callback('My Stats', 'cmd_stats')],
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
      `Please reply with your project title or developer portfolio name (2–60 characters):\n` +
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

    // STEP 1: Project Title (2 - 60 chars)
    if (session.step === 'TITLE') {
      if (text.length < 2) {
        await ctx.replyWithHTML('⚠️ Please provide a valid project title of at least 2 characters:');
        return;
      }

      if (text.length > 60) {
        await ctx.replyWithHTML(
          `⚠️ <b>Title is too long (${text.length}/60 characters).</b>\n\n` +
            `Please send a concise project title (e.g., <b>NilePay Gateway</b>):`
        );
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

    // STEP 2: Demo / Portfolio URL (8 - 250 chars, valid URL format)
    if (session.step === 'URL') {
      if (/\s/.test(text)) {
        await ctx.replyWithHTML(
          '⚠️ <b>Invalid link format:</b> URLs cannot contain spaces.\n\n' +
            'Please send a direct link starting with <code>https://</code> or <code>http://</code> (e.g., <code>https://github.com/myrepo</code>):'
        );
        return;
      }

      let url = text;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.')) url = `https://${url}`;
      }

      const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
      if (!urlPattern.test(url) || url.length < 8) {
        await ctx.replyWithHTML(
          '⚠️ <b>Invalid link format.</b>\n\n' +
            'Please send a valid URL starting with <code>https://</code> or <code>http://</code> (e.g., <code>https://yourdemo.com</code> or <code>https://github.com/name/repo</code>):'
        );
        return;
      }

      if (url.length > 250) {
        await ctx.replyWithHTML(
          `⚠️ <b>Link is too long (${url.length}/250 characters).</b>\n\n` +
            'Please send a shorter direct URL:'
        );
        return;
      }

      session.projectUrl = url;
      session.step = 'DESCRIPTION';

      await ctx.replyWithHTML(
        `<b>Demo URL Saved:</b> <code>${escapeHtml(session.projectUrl)}</code>\n\n` +
          `<b>Step 3 of 4: Short Pitch / Description</b>\n` +
          `Please write a short description (20–400 characters, 1–3 sentences) explaining what your project does:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 3: Description / Pitch (20 - 400 chars)
    if (session.step === 'DESCRIPTION') {
      if (text.length < 20) {
        await ctx.replyWithHTML(
          `⚠️ <b>Description is too short (${text.length} characters).</b>\n\n` +
            `Please write at least 1–2 complete sentences explaining what your project does (minimum 20 characters):`
        );
        return;
      }

      if (text.length > 400) {
        await ctx.replyWithHTML(
          `⚠️ <b>Description is too long (${text.length}/400 characters).</b>\n\n` +
            `Please summarize your project in 1–3 concise sentences (max 400 characters) so it fits cleanly on the Telegram showcase card:`
        );
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
          `<i>(Strongly recommended — projects with a screenshot stand out on the channel)</i>\n\n` +
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
