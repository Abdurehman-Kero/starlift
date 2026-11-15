import { Context, Markup, Telegraf } from 'telegraf';
import { getOrCreateParticipant, getParticipantByReferralCode } from '../../services/participant.service';
import { createReferral } from '../../services/referral.service';
import { getSubmissionByParticipantId } from '../../services/showcase.service';
import { getActiveInviteLink } from '../../services/invitation.service';
import { userSessions } from './submit.command';
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

    // Check if participant has already submitted their project specification
    const submission = await getSubmissionByParticipantId(participant.id);

    // If NOT submitted yet: Strict single-focus project submission prompt
    if (!submission) {
      userSessions.set(String(ctx.from.id), {
        step: 'TITLE',
        imageUrl: null,
      });

      const welcomeText =
        `<b>Welcome to NilePixel StarLift, ${name}.</b>\n\n` +
        `You are officially registered for the <b>Upwork First Job Challenge</b>.\n\n` +
        `To receive your personal channel invite link and compete on the leaderboard, please submit your project specification or developer portfolio.\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<b>Step 1 of 4: Project Title</b>\n` +
        `Please reply with your project title (or your name for a developer portfolio):\n` +
        `(e.g., <b>NilePay Gateway</b>)`;

      await ctx.replyWithHTML(
        welcomeText,
        Markup.inlineKeyboard([
          [Markup.button.callback('Cancel', 'cancel_submission')],
        ])
      );
      return;
    }

    // Already submitted: Show clean dashboard with project summary and invite link
    const subTitle = escapeHtml(submission.projectTitle || 'StarLift Showcase Project');
    const subUrl = escapeHtml(submission.projectUrl);

    let bannerNotice = '';
    if (submission.imageUrl) {
      bannerNotice = `• <b>Banner Image:</b> Attached\n`;
    } else {
      bannerNotice =
        `• <b>Banner Image:</b> Not attached (send a photo anytime to attach one)\n`;
    }

    let statusSection = '';
    if (submission.status === 'published' && submission.channelPostUrl) {
      const subReactions = submission.reactions?.reduce((sum, r) => sum + r.reactionCount, 0) || 0;
      const directReactions = (submission.participant as any).reactions?.reduce((sum: number, r: any) => sum + r.reactionCount, 0) || 0;
      const reactions = Math.max(subReactions, directReactions);
      statusSection =
        `• <b>Status:</b> Live on @NilePixelTech\n` +
        `• <b>Reactions:</b> ${reactions} community reactions\n`;
    } else {
      statusSection =
        `• <b>Status:</b> ${submission.status.toUpperCase()} (Under Review)\n`;
    }

    const activeLink = await getActiveInviteLink(participant.id);
    const linkText = activeLink
      ? `<code>${escapeHtml(activeLink.inviteLink)}</code>`
      : '<i>Tap "Get Invite Link" below to generate your link</i>';

    const existingText =
      `<b>Welcome back, ${name}.</b>\n\n` +
      `<b>Your Project Showcase:</b>\n` +
      `• <b>Title:</b> ${subTitle}\n` +
      `• <b>Demo / Portfolio:</b> <code>${subUrl}</code>\n` +
      `${bannerNotice}` +
      `${statusSection}\n` +
      `<b>Your Channel Invite Link:</b>\n` +
      `${linkText}\n\n` +
      `Share your personal invite link to gather support and climb the leaderboard.`;

    const keyboardButtons = [];
    if (submission.channelPostUrl) {
      keyboardButtons.push([Markup.button.url('View Live Showcase Post', submission.channelPostUrl)]);
    }
    keyboardButtons.push([
      Markup.button.callback('Get Invite Link', 'cmd_mylink'),
      Markup.button.callback('My Stats & Rank', 'cmd_stats'),
    ]);
    keyboardButtons.push([
      Markup.button.callback('Update Project Details', 'cmd_update_submit'),
      Markup.button.callback('Leaderboard', 'cmd_leaderboard'),
    ]);
    keyboardButtons.push([
      Markup.button.url('Official Channel', 'https://t.me/NilePixelTech'),
      Markup.button.url('Contact Support', 'https://t.me/NilePixelSupportBot'),
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
