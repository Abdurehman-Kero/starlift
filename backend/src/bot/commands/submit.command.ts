import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import {
  getSubmissionByParticipantId,
  createOrUpdateSubmission,
  notifyAdminsOfNewSubmission,
} from '../../services/showcase.service';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

interface SubmissionSession {
  step: 'TITLE' | 'URL' | 'DESCRIPTION' | 'IMAGE';
  projectTitle?: string;
  projectUrl?: string;
  description?: string;
  imageUrl?: string | null;
}

// In-memory wizard sessions per Telegram user ID
export const userSessions = new Map<string, SubmissionSession>();

/**
 * Completes the submission, saves to database, notifies contestant, and alerts administrator group
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

  // Alert Administrator Group & Admin chats
  try {
    await notifyAdminsOfNewSubmission(submission.id);
  } catch (adminAlertErr) {
    logger.warn('Failed to alert admins of new submission:', { adminAlertErr });
  }

  const title = escapeHtml(submission.projectTitle || 'Showcase Project');
  const url = escapeHtml(submission.projectUrl);
  const desc = escapeHtml(submission.description);

  const bannerNotice = submission.imageUrl
    ? `🖼️ <b>Screenshot/Banner:</b> Attached ✅\n`
    : `⚠️ <b>Screenshot/Banner:</b> <i>Not attached (you can send a photo anytime to attach it)</i>\n`;

  await ctx.replyWithHTML(
    `🎉 <b>PROJECT SPECIFICATION SUBMITTED SUCCESSFULLY!</b>\n\n` +
      `🏷️ <b>Project Title:</b> <b>${title}</b>\n` +
      `🔗 <b>Demo / Repo URL:</b> <code>${url}</code>\n` +
      `${bannerNotice}` +
      `💡 <b>Pitch Description:</b>\n${desc}\n\n` +
      `⏳ <b>Status:</b> <b>UNDER REVIEW</b>\n\n` +
      `✅ Your project specification has been delivered directly to the <b>StarLift Review Committee</b>!\n\n` +
      `📢 <b>What to do now:</b>\n` +
      `Please wait and keep an eye on our official channel <b>@NilePixelTech</b> for your showcase announcement and approval.\n\n` +
      `💬 <b>Need Help or Follow-up?</b>\n` +
      `If your project showcase is not announced on @NilePixelTech or you have any questions, please contact our support team at:\n` +
      `👉 <b>@NilePixelSupportBot</b>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 <b>WHILE YOU WAIT: EARN YOUR 70% REFERRAL SCORE</b>\n` +
      `Start inviting members right now! Every friend who joins @NilePixelTech through your personal link boosts your <b>70% Referral Score</b>:`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
        Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
      ],
      [
        Markup.button.url('📢 Official Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
        Markup.button.url('💬 Contact Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
      ],
      [
        Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
        Markup.button.callback('🏠 Main Menu', 'cmd_start'),
      ],
    ])
  );
}

/**
 * Starts the interactive step-by-step submission questionnaire
 */
export async function startSubmissionWizard(
  ctx: Context,
  participantId: number,
  initialImageUrl?: string
) {
  const telegramIdStr = String(ctx.from!.id);

  userSessions.set(telegramIdStr, {
    step: 'TITLE',
    imageUrl: initialImageUrl || null,
  });

  const photoNotice = initialImageUrl ? `🖼️ <i>Your uploaded photo is saved and will be attached!</i>\n\n` : '';

  await ctx.replyWithHTML(
    `🚀 <b>PROJECT SPECIFICATION SUBMISSION</b>\n` +
      `<b>Step 1 of 4: Project Title</b>\n\n` +
      `${photoNotice}` +
      `🏷️ <b>What is your Project Title?</b>\n` +
      `<i>Please type and reply with the name of your project (e.g., <b>NilePay Gateway</b>):</i>`,
    Markup.inlineKeyboard([
      [Markup.button.callback('❌ Cancel Submission', 'cancel_submission')],
    ])
  );
}

export function registerSubmitCommand(bot: Telegraf) {
  // 1. Command /submit (either quick one-liner OR launches interactive wizard)
  bot.command('submit', async (ctx: Context) => {
    if (!ctx.from) return;

    const telegramId = BigInt(ctx.from.id);
    const telegramIdStr = String(ctx.from.id);

    try {
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant || !participant.isCompetitor) {
        await ctx.replyWithHTML(
          '🌟 Please register for the StarLift challenge first by sending /start.'
        );
        return;
      }

      const message = ctx.message;
      let fullText = '';
      if (message && 'text' in message) {
        fullText = message.text.trim();
      }

      const payload = fullText.replace(/^\/submit(@\w+)?/i, '').trim();

      // If user provided pipes (Quick One-Liner): Title | URL | Description | Optional Image
      if (payload.includes('|')) {
        const parts = payload.split('|').map((p) => p.trim());
        const title = parts[0] || 'StarLift Showcase Project';
        let projectUrl = parts[1] || '';
        let description = parts[2] || 'Innovative tech showcase entry for NilePixel StarLift.';
        let imageUrl: string | undefined = undefined;

        if (parts.length >= 4 && parts[3].startsWith('http')) {
          imageUrl = parts[3];
        } else if (parts.length > 3) {
          description = parts.slice(2).join(' | ');
        }

        if (!projectUrl.startsWith('http://') && !projectUrl.startsWith('https://')) {
          if (projectUrl.includes('.')) projectUrl = `https://${projectUrl}`;
        }

        if (!projectUrl.startsWith('http')) {
          await ctx.replyWithHTML(
            '⚠️ <b>Invalid URL format.</b> Please ensure your URL starts with <code>https://</code> or <code>http://</code>.'
          );
          return;
        }

        await finalizeSubmission(ctx, participant.id, {
          step: 'IMAGE',
          projectTitle: title,
          projectUrl,
          description,
          imageUrl: imageUrl || null,
        });
        return;
      }

      // No pipe payload: launch the friendly, step-by-step interactive questionnaire!
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

  // 3. Skip Image callback button in Step 4
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
      await finalizeSubmission(ctx, participant.id, session);
    } catch (err) {
      logger.error('Error in skip_submission_image callback:', { err });
    }
  });

  // 4. Cancel submission callback
  bot.action('cancel_submission', async (ctx: Context) => {
    if (!ctx.from) return;

    try {
      await ctx.answerCbQuery('Submission cancelled.');
      const telegramIdStr = String(ctx.from.id);
      userSessions.delete(telegramIdStr);
      await ctx.reply('❌ Project submission cancelled. You can start anytime with /submit or /start.');
    } catch (err) {
      logger.error('Error in cancel_submission callback:', { err });
    }
  });

  // 5. Intercept interactive text replies during steps 1, 2, 3, 4
  bot.on('text', async (ctx: Context, next: () => Promise<void>) => {
    if (!ctx.from || !ctx.message || !('text' in ctx.message)) return next();

    const telegramIdStr = String(ctx.from.id);
    const text = ctx.message.text.trim();

    // If it's a command like /start, /help, /stats, /mylink, cancel wizard and proceed
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
        await ctx.reply('⚠️ Please provide a valid project title:');
        return;
      }

      session.projectTitle = text;
      session.step = 'URL';

      await ctx.replyWithHTML(
        `✅ <b>Project Title:</b> <b>${escapeHtml(session.projectTitle)}</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `🔗 <b>Step 2 of 4: Project Demo or Repository URL</b>\n` +
          `<i>Please send your live website link, web app URL, or GitHub repository:</i>\n` +
          `(e.g., <code>https://nilepay.et</code> or <code>https://github.com/...</code>)`,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 2: Project URL
    if (session.step === 'URL') {
      let url = text;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        if (url.includes('.')) url = `https://${url}`;
      }

      if (!url.startsWith('http')) {
        await ctx.replyWithHTML(
          '⚠️ <b>Invalid URL format.</b> Please send a valid link starting with <code>https://</code> or <code>http://</code> (e.g. <code>https://yourdemo.com</code>):'
        );
        return;
      }

      session.projectUrl = url;
      session.step = 'DESCRIPTION';

      await ctx.replyWithHTML(
        `✅ <b>Project Demo:</b> <code>${escapeHtml(session.projectUrl)}</code>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `💡 <b>Step 3 of 4: Short Pitch / Description</b>\n` +
          `<i>Please write a brief summary (1–3 sentences) explaining what your project does, what problem it solves, and why people should vote for it:</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('❌ Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 3: Description / Pitch -> IMMEDIATELY ASK FOR THE IMAGE!
    if (session.step === 'DESCRIPTION') {
      if (text.length < 5) {
        await ctx.reply('⚠️ Please provide a short description of at least a few words:');
        return;
      }

      session.description = text;

      // If user had already uploaded a photo when starting wizard:
      if (session.imageUrl) {
        await finalizeSubmission(ctx, participant.id, session);
        return;
      }

      session.step = 'IMAGE';

      await ctx.replyWithHTML(
        `✅ <b>Pitch Description Saved!</b>\n\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `📸 <b>Step 4 of 4: Project Banner / Screenshot Image</b>\n` +
          `<b>(STRONGLY RECOMMENDED)</b>\n\n` +
          `Showcase posts with a visual banner receive <b>up to 5x more votes and community reactions</b> on @NilePixelTech (which make up <b>30% of your total competition score</b>)!\n\n` +
          `👉 <b>Please send a screenshot or banner photo of your project now</b> (or paste an image link).\n\n` +
          `<i>If you don't have an image right now, tap "Skip Image" below and add one later:</i>`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Skip Image (Text Only)', 'skip_submission_image')],
          [Markup.button.callback('❌ Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // STEP 4: Image URL via text
    if (session.step === 'IMAGE') {
      if (text.startsWith('http://') || text.startsWith('https://')) {
        session.imageUrl = text;
        await finalizeSubmission(ctx, participant.id, session);
        return;
      }

      await ctx.replyWithHTML(
        `⚠️ Please send an image photo or link starting with <code>https://</code>, or tap <b>Skip Image</b>:`,
        Markup.inlineKeyboard([
          [Markup.button.callback('⏭️ Skip Image (Text Only)', 'skip_submission_image')],
          [Markup.button.callback('❌ Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    return next();
  });

  // 6. Handle Photos uploaded by contestants
  bot.on('photo', async (ctx: Context) => {
    if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;

    const telegramId = BigInt(ctx.from.id);
    const telegramIdStr = String(ctx.from.id);

    try {
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant || !participant.isCompetitor) {
        await ctx.replyWithHTML(
          '🌟 Please register for the StarLift challenge first by sending /start.'
        );
        return;
      }

      const photos = ctx.message.photo;
      const bestPhoto = photos[photos.length - 1];
      const fileId = bestPhoto.file_id;

      // Case A: User is in the middle of the submission wizard
      const session = userSessions.get(telegramIdStr);
      if (session) {
        session.imageUrl = fileId;

        // If they were at Step 4 (asking for image): finalize immediately!
        if (session.step === 'IMAGE' && session.projectUrl && session.description) {
          await finalizeSubmission(ctx, participant.id, session);
          return;
        }

        // Otherwise save photo and continue with whatever step they are at
        await ctx.replyWithHTML(
          `🖼️ <b>Screenshot/Banner Photo Attached!</b>\n` +
            `Now, please continue with the current step above.`
        );
        return;
      }

      // Case B: User already has an existing submission -> Update their banner photo!
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
          `🖼️ <b>Showcase Banner Photo Updated!</b>\n\n` +
            `Your photo has been attached to your project <b>${escapeHtml(existing.projectTitle || 'Showcase Project')}</b>.\n\n` +
            `Our team in the Administrator Group will use this image when featuring your project on @NilePixelTech!`
        );
        return;
      }

      // Case C: User has no submission yet -> Start wizard with this photo attached!
      await startSubmissionWizard(ctx, participant.id, fileId);
    } catch (err) {
      logger.error('Error handling photo message:', { err });
      await ctx.reply('An error occurred while processing the photo. Please try again.');
    }
  });
}
