import { prisma } from '../database/client';
import { bot } from '../bot/bot';
import { getSetting } from './settings.service';
import { env } from '../config/env';
import logger from '../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export interface CreateSubmissionData {
  participantId: number;
  projectTitle?: string;
  projectUrl: string;
  description: string;
  status?: string;
}

export async function createOrUpdateSubmission(data: CreateSubmissionData) {
  const existing = await prisma.projectSubmission.findUnique({
    where: { participantId: data.participantId },
  });

  if (existing) {
    return prisma.projectSubmission.update({
      where: { id: existing.id },
      data: {
        projectTitle: data.projectTitle ?? existing.projectTitle,
        projectUrl: data.projectUrl,
        description: data.description,
        status: data.status ?? existing.status,
      },
      include: { participant: true, reactions: true },
    });
  }

  return prisma.projectSubmission.create({
    data: {
      participantId: data.participantId,
      projectTitle: data.projectTitle,
      projectUrl: data.projectUrl,
      description: data.description,
      status: data.status ?? 'pending',
    },
    include: { participant: true, reactions: true },
  });
}

export async function getSubmissionByParticipantId(participantId: number) {
  return prisma.projectSubmission.findUnique({
    where: { participantId },
    include: {
      reactions: true,
      participant: {
        include: {
          invitationLinks: { where: { isActive: true }, take: 1 },
        },
      },
    },
  });
}

export async function publishShowcaseToChannel(submissionId: number, adminEmail?: string) {
  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: {
      participant: {
        include: {
          invitationLinks: { where: { isActive: true }, orderBy: { createdAt: 'desc' } },
        },
      },
    },
  });

  if (!submission) {
    throw new Error('Project submission not found');
  }

  const { participant } = submission;
  const channelSetting = await getSetting('TELEGRAM_CHANNEL_ID');
  const targetChannel = (channelSetting || env.TELEGRAM_CHANNEL_ID || '@NilePixelTech').trim();

  const title = escapeHtml(submission.projectTitle || 'StarLift Showcase Project');
  const contestantName = escapeHtml(participant.firstName);
  const contestantHandle = participant.username ? `@${escapeHtml(participant.username)}` : null;
  const referralCode = escapeHtml(participant.referralCode);
  const projectUrl = escapeHtml(submission.projectUrl);
  const description = escapeHtml(submission.description);
  const inviteLink = submission.participant.invitationLinks[0]?.inviteLink;

  const authorLine = contestantHandle
    ? `👨‍💻 <b>Contestant:</b> ${contestantName} (${contestantHandle})`
    : `👨‍💻 <b>Contestant:</b> ${contestantName}`;

  const linkActionText = inviteLink
    ? `2. 🤝 Join @NilePixelTech using their personal link:\n   <code>${inviteLink}</code>`
    : `2. 🤝 Support them in the NilePixel StarLift Showcase!`;

  const postText =
    `🚀 <b>StarLift Project Showcase: ${title}</b>\n\n` +
    `${authorLine}\n` +
    `🔑 <b>Referral Code:</b> <code>${referralCode}</code>\n` +
    `🔗 <b>Project URL:</b> <a href="${projectUrl}">${projectUrl}</a>\n\n` +
    `💡 <b>Project Pitch:</b>\n` +
    `${description}\n\n` +
    `🗳️ <b>How to Vote & Support:</b>\n` +
    `1. ❤️ <b>React to this post</b> (❤️, 🔥, 🚀, 👍, 👏) to cast your vote! (30% weight)\n` +
    `${linkActionText}\n\n` +
    `<i>NilePixel StarLift Project Showcase Challenge (Nov 15 – Nov 30, 2026)</i>`;

  // Publish to Telegram Channel
  const sentMessage = await bot.telegram.sendMessage(targetChannel, postText, {
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: false },
  });

  const messageId = sentMessage.message_id;

  // Compute public channel URL
  let postUrl: string;
  if (targetChannel.startsWith('@')) {
    const handle = targetChannel.replace('@', '');
    postUrl = `https://t.me/${handle}/${messageId}`;
  } else if (targetChannel.startsWith('-100')) {
    const internalId = targetChannel.replace('-100', '');
    postUrl = `https://t.me/c/${internalId}/${messageId}`;
  } else {
    postUrl = `https://t.me/NilePixelTech/${messageId}`;
  }

  // Update submission in database
  const updatedSubmission = await prisma.projectSubmission.update({
    where: { id: submission.id },
    data: {
      channelMessageId: messageId,
      channelPostUrl: postUrl,
      status: 'published',
      publishedAt: new Date(),
      verifiedAt: new Date(),
      verifiedBy: adminEmail ?? 'admin',
    },
    include: { participant: true, reactions: true },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      adminEmail: adminEmail ?? 'admin',
      participantId: participant.id,
      action: 'SHOWCASE_PUBLISHED_TO_CHANNEL',
      details: JSON.stringify({
        submissionId: submission.id,
        channelMessageId: messageId,
        channelPostUrl: postUrl,
      }),
    },
  });

  // Notify contestant via private DM from bot
  try {
    const dmText =
      `🎉 <b>Congratulations, ${contestantName}!</b>\n\n` +
      `Your project <b>${title}</b> has officially been published on the channel!\n\n` +
      `📢 <b>Showcase Post Link:</b>\n` +
      `<a href="${postUrl}">${postUrl}</a>\n\n` +
      `🔥 <b>What to do next:</b>\n` +
      `• Share this post with your friends, communities, and tech groups.\n` +
      `• Ask everyone to react with emojis (❤️, 🔥, 🚀, 👍) to boost your <b>30% Reaction Score</b>.\n` +
      `• Track your live standings anytime with /stats!`;

    await bot.telegram.sendMessage(participant.telegramId.toString(), dmText, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
    });
  } catch (dmErr) {
    logger.warn('Failed to send private showcase notification to contestant:', { dmErr });
  }

  return updatedSubmission;
}

/**
 * Automatically updates reactions whenever Telegram fires a message_reaction_count event
 */
export async function syncReactionCountForMessage(channelMessageId: number, totalCount: number) {
  const submission = await prisma.projectSubmission.findFirst({
    where: { channelMessageId },
    include: { participant: true },
  });

  if (!submission) {
    logger.debug(`No showcase submission linked to channelMessageId ${channelMessageId}`);
    return null;
  }

  const existingReaction = await prisma.projectReaction.findFirst({
    where: { submissionId: submission.id },
  });

  const reaction = existingReaction
    ? await prisma.projectReaction.update({
        where: { id: existingReaction.id },
        data: {
          reactionCount: totalCount,
          source: 'telegram_channel_auto',
          recordedBy: 'system_auto_sync',
        },
      })
    : await prisma.projectReaction.create({
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount: totalCount,
          source: 'telegram_channel_auto',
          recordedBy: 'system_auto_sync',
        },
      });

  logger.info(
    `✅ Auto-synced reactions for ${submission.participant.firstName}: ${totalCount} reactions (message #${channelMessageId})`
  );

  return reaction;
}
