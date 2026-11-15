import { Context, Markup, Telegraf } from 'telegraf';
import { getOrCreateParticipant, getParticipantByReferralCode } from '../../services/participant.service';
import { createReferral } from '../../services/referral.service';
import { getSubmissionByParticipantId } from '../../services/showcase.service';
import { prisma } from '../../database/client';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function renderStartScreen(ctx: Context) {
  if (!ctx.from) return;

  const telegramId = BigInt(ctx.from.id);
  const firstName = ctx.from.first_name ?? 'Contestant';
  const lastName = ctx.from.last_name;
  const username = ctx.from.username;

  try {
    const { participant, isNew } = await getOrCreateParticipant({
      telegramId,
      username,
      firstName,
      lastName,
      isCompetitor: true,
    });

    // Parse deep link payload for referral code
    const message = ctx.message;
    let referralCode: string | undefined;

    if (message && 'text' in message) {
      const parts = message.text.trim().split(/\s+/);
      if (parts.length > 1) {
        referralCode = parts[1];
      }
    }

    if (referralCode && isNew) {
      const referrer = await getParticipantByReferralCode(referralCode);
      if (referrer && referrer.id !== participant.id) {
        await createReferral({
          referrerId: referrer.id,
          referredId: participant.id,
        });

        await prisma.activityLog.create({
          data: {
            participantId: participant.id,
            action: 'REFERRAL_CREATED',
            details: JSON.stringify({ referrerId: referrer.id, referralCode }),
          },
        });

        logger.info('Referral created via start command deep-link', {
          referrerId: referrer.id,
          referredId: participant.id,
        });
      }
    }

    const name = escapeHtml(firstName);
    const code = escapeHtml(participant.referralCode);

    // Check if participant has already submitted their project specification
    const submission = await getSubmissionByParticipantId(participant.id);

    if (!submission) {
      // IMMEDIATE ACTION: Prompt them to submit project specification & strongly advise image
      const welcomeText =
        `🌟 <b>Welcome to NilePixel StarLift, ${name}!</b>\n\n` +
        `You are officially registered for the <b>StarLift Project Showcase Challenge</b>!\n` +
        `🔑 <b>Your Referral Code:</b> <code>${code}</code>\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎯 <b>IMMEDIATE ACTION: SUBMIT YOUR PROJECT SPECIFICATION</b>\n` +
        `Before you begin inviting members, you must submit your project showcase details so our team can feature your work on @NilePixelTech!\n\n` +
        `📝 <b>How to Submit Your Project:</b>\n` +
        `Send a message in this exact format:\n` +
        `<code>/submit Project Title | https://yourdemo.com | Short pitch description</code>\n\n` +
        `📸 <b>STRONGLY RECOMMENDED: ATTACH AN IMAGE / SCREENSHOT!</b>\n` +
        `Showcase posts with a visual banner receive significantly more votes and reactions (<b>30% Score Weight</b>)!\n\n` +
        `👉 <b>How to submit with an image:</b>\n` +
        `Simply upload your project screenshot or banner photo directly to this chat with the caption:\n` +
        `<code>/submit Project Title | https://yourdemo.com | Short pitch</code>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💡 <i>Once submitted, you will immediately unlock your personal channel invite link to begin earning your 70% referral score!</i>`;

      await ctx.replyWithHTML(
        welcomeText,
        Markup.inlineKeyboard([
          [
            Markup.button.callback('💡 Submit Project Specification Now', 'cmd_submit'),
          ],
          [
            Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
            Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
          ],
          [
            Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
            Markup.button.callback('ℹ️ Guide & Rules', 'cmd_help'),
          ],
          [
            Markup.button.url('📢 Official Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
          ],
        ])
      );
      return;
    }

    // Already submitted: Show project status and image advice if missing
    const subTitle = escapeHtml(submission.projectTitle || 'StarLift Showcase Project');
    const subUrl = escapeHtml(submission.projectUrl);

    let bannerNotice = '';
    if (submission.imageUrl) {
      bannerNotice = `🖼️ <b>Showcase Banner:</b> Attached ✅\n`;
    } else {
      bannerNotice =
        `⚠️ <b>Showcase Banner:</b> <i>Not attached yet</i>\n` +
        `👉 <b>Strongly recommended:</b> <i>Send a screenshot/photo to this chat now to attach it for higher votes!</i>\n`;
    }

    let statusSection = '';
    if (submission.status === 'published' && submission.channelPostUrl) {
      const reactions = submission.reactions.reduce((sum, r) => sum + r.reactionCount, 0);
      statusSection =
        `🚀 <b>Your Project is LIVE on @NilePixelTech!</b>\n` +
        `📢 <b>Channel Post:</b> <a href="${submission.channelPostUrl}">View Live Post</a>\n` +
        `❤️ <b>Community Reactions:</b> <b>${reactions}</b> reactions (synced live!)\n`;
    } else {
      statusSection =
        `⏳ <b>Review Status:</b> <b>${submission.status.toUpperCase()}</b>\n` +
        `<i>Our team is reviewing your specification. You will be notified the instant it is published to @NilePixelTech!</i>\n`;
    }

    const existingText =
      `👋 <b>Welcome back, ${name}!</b>\n\n` +
      `🚀 <b>Your StarLift Project Showcase:</b>\n` +
      `🏷️ <b>Title:</b> <b>${subTitle}</b>\n` +
      `🔗 <b>Demo:</b> <code>${subUrl}</code>\n` +
      `${bannerNotice}` +
      `${statusSection}\n` +
      `📢 <b>Showcase Announcement:</b>\n` +
      `Please keep an eye on <b>@NilePixelTech</b> for your project approval!\n` +
      `If not announced on the channel, contact: <b>@NilePixelSupportBot</b>.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🤝 <b>NEXT STEP: EARN YOUR 70% REFERRAL SCORE</b>\n` +
      `Share your personal channel invite link with friends and developers. Every verified join boosts your ranking!`;

    const keyboardButtons = [];
    if (submission.channelPostUrl) {
      keyboardButtons.push([Markup.button.url('🚀 View Channel Post', submission.channelPostUrl)]);
    }
    keyboardButtons.push([
      Markup.button.callback('🔗 Get My Invite Link', 'cmd_mylink'),
      Markup.button.callback('📊 My Stats & Rank', 'cmd_stats'),
    ]);
    keyboardButtons.push([
      Markup.button.callback('💡 Update Project Details', 'cmd_submit'),
      Markup.button.callback('🏆 Leaderboard', 'cmd_leaderboard'),
    ]);
    keyboardButtons.push([
      Markup.button.url('📢 Official Channel (@NilePixelTech)', 'https://t.me/NilePixelTech'),
      Markup.button.url('💬 Contact Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot'),
    ]);

    await ctx.replyWithHTML(existingText, Markup.inlineKeyboard(keyboardButtons));
  } catch (error) {
    logger.error('Error in /start command', { error });
    await ctx.reply('An error occurred while loading your profile. Please try again.');
  }
}

export function registerStartCommand(bot: Telegraf) {
  bot.command('start', async (ctx: Context) => {
    await renderStartScreen(ctx);
  });

  bot.action('cmd_start', async (ctx: Context) => {
    try {
      await ctx.answerCbQuery();
      await renderStartScreen(ctx);
    } catch (err) {
      logger.error('Error in cmd_start callback', { err });
    }
  });
}
