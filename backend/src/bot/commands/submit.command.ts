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

async function handleSubmit(ctx: Context) {
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);

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

    // Extract payload after /submit
    const payload = fullText.replace(/^\/submit(@\w+)?/i, '').trim();

    // If payload provided: format is Title | URL | Description | Optional Image URL
    if (payload.includes('|')) {
      const parts = payload.split('|').map((p) => p.trim());
      const title = parts[0] || 'StarLift Showcase Project';
      const projectUrl = parts[1] || '';
      let description = parts[2] || 'Innovative tech showcase entry for NilePixel StarLift.';
      let imageUrl: string | undefined = undefined;

      if (parts.length >= 4 && parts[3].startsWith('http')) {
        imageUrl = parts[3];
      } else if (parts.length > 3) {
        description = parts.slice(2).join(' | ');
      }

      if (!projectUrl || !projectUrl.startsWith('http')) {
        await ctx.replyWithHTML(
          '⚠️ <b>Invalid URL format.</b> Please ensure your project URL starts with <code>https://</code> or <code>http://</code>.\n\n' +
            '<b>Format:</b> <code>/submit Project Name | https://yourdemo.com | Short pitch | Optional Image URL</code>'
        );
        return;
      }

      const submission = await createOrUpdateSubmission({
        participantId: participant.id,
        projectTitle: title,
        projectUrl,
        description,
        imageUrl: imageUrl || null,
        status: 'pending',
      });

      // Immediately alert admins with 1-click Publish/Ignore buttons
      try {
        await notifyAdminsOfNewSubmission(submission.id);
      } catch (adminAlertErr) {
        logger.warn('Failed to alert admins of new submission:', { adminAlertErr });
      }

      const imageNotice = submission.imageUrl
        ? `🖼️ <b>Preview Image:</b> Attached\n`
        : '';

      await ctx.replyWithHTML(
        `✅ <b>Project Submission Received!</b>\n\n` +
          `🏷️ <b>Title:</b> ${escapeHtml(submission.projectTitle || title)}\n` +
          `🔗 <b>Demo / Repo URL:</b> <code>${escapeHtml(submission.projectUrl)}</code>\n` +
          `${imageNotice}` +
          `💡 <b>Pitch:</b>\n${escapeHtml(submission.description)}\n\n` +
          `⏳ <b>Status:</b> <b>Under Review</b>\n\n` +
          `Our technical team has been notified. Once approved, it will be published directly to @NilePixelTech with automated reaction voting!`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
            Markup.button.callback('🔗 My Invite Link', 'cmd_mylink'),
          ],
        ])
      );
      return;
    }

    // No payload: Show current submission status or instructions
    const existing = await getSubmissionByParticipantId(participant.id);

    if (existing) {
      const reactionsCount = existing.reactions.reduce((sum, r) => sum + r.reactionCount, 0);
      const title = escapeHtml(existing.projectTitle || 'Showcase Project');
      const url = escapeHtml(existing.projectUrl);
      const desc = escapeHtml(existing.description);

      if (existing.status === 'published' && existing.channelPostUrl) {
        await ctx.replyWithHTML(
          `🚀 <b>Your Project Showcase Is Live on Telegram!</b>\n\n` +
            `🏷️ <b>Title:</b> <b>${title}</b>\n` +
            `🔗 <b>Live Demo:</b> <a href="${url}">${url}</a>\n` +
            `📢 <b>Showcase Post:</b> <a href="${existing.channelPostUrl}">View on @NilePixelTech</a>\n` +
            `❤️ <b>Live Community Reactions:</b> <b>${reactionsCount}</b> reactions (synced live!)\n\n` +
            `🔥 Share your post with friends and developer groups. Every emoji reaction boosts your <b>30% Reaction Score</b>!`,
          Markup.inlineKeyboard([
            [
              Markup.button.url('🚀 View Channel Post', existing.channelPostUrl),
              Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
            ],
            [
              Markup.button.callback('🔄 Refresh Stats', 'cmd_stats'),
              Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
            ],
          ])
        );
        return;
      }

      const imgNotice = existing.imageUrl ? `🖼️ <b>Banner:</b> Attached\n` : '';

      await ctx.replyWithHTML(
        `⏳ <b>Your Project Submission Status:</b> <b>${existing.status.toUpperCase()}</b>\n\n` +
          `🏷️ <b>Title:</b> ${title}\n` +
          `🔗 <b>Project URL:</b> <code>${url}</code>\n` +
          `${imgNotice}` +
          `💡 <b>Pitch:</b>\n${desc}\n\n` +
          `<i>Our team is reviewing your submission. You will be notified the moment it is published to @NilePixelTech!</i>\n\n` +
          `<b>Need to update?</b>\n` +
          `• Send text: <code>/submit New Title | https://new-url.com | Updated pitch</code>\n` +
          `• Or send a photo with updated caption!`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📊 My Stats', 'cmd_stats'),
            Markup.button.callback('🔗 My Invite Link', 'cmd_mylink'),
          ],
        ])
      );
      return;
    }

    // No submission yet: Show comprehensive instructions
    await ctx.replyWithHTML(
      `🚀 <b>Submit Your StarLift Project Showcase</b>\n\n` +
        `Showcase your project to thousands of developers on @NilePixelTech and compete for the StarLift prizes!\n\n` +
        `📝 <b>Option 1: Quick Text Format</b>\n` +
        `Send a message in this format:\n` +
        `<code>/submit Project Title | https://yourdemo.com | Short pitch</code>\n` +
        `<i>With optional image link:</i>\n` +
        `<code>/submit Title | https://yourdemo.com | Pitch | https://example.com/banner.png</code>\n\n` +
        `📸 <b>Option 2: Direct Photo / Screenshot Upload (Recommended)</b>\n` +
        `Simply upload a screenshot or banner photo to this bot with the caption:\n` +
        `<code>/submit Project Title | https://yourdemo.com | Short pitch</code>\n\n` +
        `<i>Once submitted, our team will review and publish your entry directly to @NilePixelTech with automated reaction voting!</i>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
          Markup.button.callback('📊 My Stats', 'cmd_stats'),
        ],
        [
          Markup.button.url('📢 View Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
        ],
      ])
    );
  } catch (err) {
    logger.error('Error in /submit command:', { err });
    await ctx.reply('An error occurred while loading project submission. Please try again.');
  }
}

export function registerSubmitCommand(bot: Telegraf) {
  // Command /submit
  bot.command('submit', async (ctx: Context) => {
    await handleSubmit(ctx);
  });

  // Inline button cmd_submit
  bot.action('cmd_submit', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      await handleSubmit(ctx);
    } catch (err) {
      logger.error('Error in cmd_submit callback', { err });
    }
  });

  // Handle direct photo uploads from contestants
  bot.on('photo', async (ctx: Context) => {
    if (!ctx.from || !ctx.message || !('photo' in ctx.message)) return;

    const telegramId = BigInt(ctx.from.id);

    try {
      const participant = await getParticipantByTelegramId(telegramId);
      if (!participant || !participant.isCompetitor) {
        await ctx.replyWithHTML(
          '🌟 Please register for the StarLift challenge first by sending /start.'
        );
        return;
      }

      // Pick highest resolution photo
      const photos = ctx.message.photo;
      const bestPhoto = photos[photos.length - 1];
      const fileId = bestPhoto.file_id;

      const caption = ctx.message.caption ? ctx.message.caption.trim() : '';

      // If caption has '|', parse as submission: Title | URL | Pitch
      if (caption.includes('|')) {
        const payload = caption.replace(/^\/submit(@\w+)?/i, '').trim();
        const parts = payload.split('|').map((p) => p.trim());
        const title = parts[0] || 'StarLift Showcase Project';
        const projectUrl = parts[1] || '';
        const description = parts.slice(2).join(' | ') || 'Innovative tech showcase entry for NilePixel StarLift.';

        if (!projectUrl || !projectUrl.startsWith('http')) {
          await ctx.replyWithHTML(
            '⚠️ <b>Invalid URL format in photo caption.</b> Please ensure your project URL starts with <code>https://</code> or <code>http://</code>.\n\n' +
              '<b>Format:</b> <code>/submit Project Name | https://yourdemo.com | Short pitch</code>'
          );
          return;
        }

        const submission = await createOrUpdateSubmission({
          participantId: participant.id,
          projectTitle: title,
          projectUrl,
          description,
          imageUrl: fileId,
          status: 'pending',
        });

        // Notify admins with 1-click Publish/Ignore buttons
        try {
          await notifyAdminsOfNewSubmission(submission.id);
        } catch (alertErr) {
          logger.warn('Failed to alert admins of photo submission:', { alertErr });
        }

        await ctx.replyWithHTML(
          `✅ <b>Project Submission Received with Photo!</b>\n\n` +
            `🏷️ <b>Title:</b> ${escapeHtml(submission.projectTitle || title)}\n` +
            `🔗 <b>Demo / Repo URL:</b> <code>${escapeHtml(submission.projectUrl)}</code>\n` +
            `🖼️ <b>Screenshot/Banner:</b> Attached\n` +
            `💡 <b>Pitch:</b>\n${escapeHtml(submission.description)}\n\n` +
            `⏳ <b>Status:</b> <b>Under Review</b>\n\n` +
            `Our technical team has been notified. Once approved, it will be published directly to @NilePixelTech with automated reaction voting!`,
          Markup.inlineKeyboard([
            [
              Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
              Markup.button.callback('🔗 My Invite Link', 'cmd_mylink'),
            ],
          ])
        );
        return;
      }

      // If no pipe in caption, check if user already has an existing submission
      const existing = await getSubmissionByParticipantId(participant.id);
      if (existing) {
        // Update existing submission's photo
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
            `Our team will use this image when featuring your project on @NilePixelTech!`
        );
        return;
      }

      // No existing submission and no caption pipes
      await ctx.replyWithHTML(
        `📸 <b>Photo received!</b>\n\n` +
          `To submit your project showcase with this photo, please reply to this message or send:\n\n` +
          `<code>/submit Project Title | https://yourdemo.com | Short pitch</code>`
      );
    } catch (err) {
      logger.error('Error handling photo message:', { err });
      await ctx.reply('An error occurred while processing the photo. Please try again.');
    }
  });
}
