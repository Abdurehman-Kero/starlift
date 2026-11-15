import { Context, Markup, Telegraf } from 'telegraf';
import { getParticipantByTelegramId } from '../../services/participant.service';
import { getSubmissionByParticipantId, createOrUpdateSubmission } from '../../services/showcase.service';
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

    // If payload provided: format is Title | URL | Description
    if (payload.includes('|')) {
      const parts = payload.split('|').map((p) => p.trim());
      const title = parts[0] || 'StarLift Showcase Project';
      const projectUrl = parts[1] || '';
      const description = parts.slice(2).join(' | ') || 'Innovative tech showcase entry for NilePixel StarLift.';

      if (!projectUrl || !projectUrl.startsWith('http')) {
        await ctx.replyWithHTML(
          '⚠️ <b>Invalid URL format.</b> Please ensure your project URL starts with <code>https://</code> or <code>http://</code>.\n\n' +
            '<b>Format:</b> <code>/submit Project Name | https://yourdemo.com | Short pitch</code>'
        );
        return;
      }

      const submission = await createOrUpdateSubmission({
        participantId: participant.id,
        projectTitle: title,
        projectUrl,
        description,
        status: 'pending',
      });

      await ctx.replyWithHTML(
        `✅ <b>Project Submission Received!</b>\n\n` +
          `🏷️ <b>Title:</b> ${escapeHtml(submission.projectTitle || title)}\n` +
          `🔗 <b>Demo / Repo URL:</b> <code>${escapeHtml(submission.projectUrl)}</code>\n` +
          `💡 <b>Pitch:</b>\n${escapeHtml(submission.description)}\n\n` +
          `⏳ <b>Status:</b> <b>Under Review</b>\n\n` +
          `Our technical team will review your project. Once approved, it will be published directly to @NilePixelTech, and you will receive an instant notification here with your live post link!`,
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

      await ctx.replyWithHTML(
        `⏳ <b>Your Project Submission Status:</b> <b>${existing.status.toUpperCase()}</b>\n\n` +
          `🏷️ <b>Title:</b> ${title}\n` +
          `🔗 <b>Project URL:</b> <code>${url}</code>\n` +
          `💡 <b>Pitch:</b>\n${desc}\n\n` +
          `<i>Our team is reviewing your submission. You will be notified the moment it is published to @NilePixelTech!</i>\n\n` +
          `Need to update your submission? Send:\n` +
          `<code>/submit New Title | https://new-url.com | Updated pitch</code>`,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('📊 My Stats', 'cmd_stats'),
            Markup.button.callback('🔗 My Invite Link', 'cmd_mylink'),
          ],
        ])
      );
      return;
    }

    // No submission yet
    await ctx.replyWithHTML(
      `🚀 <b>Submit Your StarLift Project Showcase</b>\n\n` +
        `Ready to showcase your project to thousands of developers on @NilePixelTech and compete for the StarLift prizes?\n\n` +
        `📝 <b>How to Submit:</b>\n` +
        `Send a message in this exact format:\n` +
        `<code>/submit Project Title | Live URL or GitHub | Short Pitch</code>\n\n` +
        `<b>Example:</b>\n` +
        `<code>/submit NilePay Gateway | https://nilepay.et | Next-gen payment API for African developers</code>\n\n` +
        `<i>Once submitted, our team will review and publish your showcase post on @NilePixelTech with automated reaction voting!</i>`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
          Markup.button.callback('📊 My Stats', 'cmd_stats'),
        ],
        [
          Markup.button.url('💬 Ask Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
        ],
      ])
    );
  } catch (err) {
    logger.error('Error in /submit command:', { err });
    await ctx.reply('An error occurred while loading project submission. Please try again.');
  }
}

export function registerSubmitCommand(bot: Telegraf) {
  bot.command('submit', async (ctx: Context) => {
    await handleSubmit(ctx);
  });

  bot.action('cmd_submit', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      await handleSubmit(ctx);
    } catch (err) {
      logger.error('Error in cmd_submit callback', { err });
    }
  });
}
