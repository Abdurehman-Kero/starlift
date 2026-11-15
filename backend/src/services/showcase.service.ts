import { prisma } from '../database/client';
import { bot } from '../bot/bot';
import { Markup } from 'telegraf';
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
  imageUrl?: string | null;
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
        imageUrl: data.imageUrl !== undefined ? data.imageUrl : existing.imageUrl,
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
      imageUrl: data.imageUrl ?? null,
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
          reactions: true,
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
    ? `👨‍💻 <b>Creator:</b> ${contestantName} (${contestantHandle})`
    : `👨‍💻 <b>Creator:</b> ${contestantName}`;

  const linkActionText = inviteLink
    ? `🤝 <b>Support ${contestantName}:</b>\nJoin via their personal link:\n<code>${inviteLink}</code>`
    : `🤝 <b>Support ${contestantName}</b> in the StarLift Showcase!`;

  // Senior-designer formatted clean Telegram card
  const postCard =
    `🌟 <b>STARLIFT PROJECT SHOWCASE</b>\n` +
    `🚀 <b>${title}</b>\n\n` +
    `${authorLine}\n` +
    `🔑 <b>Code:</b> <code>${referralCode}</code>\n` +
    `🔗 <b>Live Demo / Repo:</b> <a href="${projectUrl}">${projectUrl}</a>\n\n` +
    `💡 <b>About the Project:</b>\n` +
    `${description}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🗳️ <b>COMMUNITY VOTING (30% Score Weight):</b>\n` +
    `React below with <b>❤️, 🔥, 🚀, 👍, 👏</b> to cast your vote!\n\n` +
    `${linkActionText}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>NilePixel StarLift Challenge (Nov 15 – 30, 2026)</i>`;

  let sentMessage: { message_id: number };

  // If image URL or Telegram file_id is provided, send as photo with caption; fallback to message if photo fails
  if (submission.imageUrl && submission.imageUrl.trim().length > 0) {
    try {
      sentMessage = await bot.telegram.sendPhoto(targetChannel, submission.imageUrl.trim(), {
        caption: postCard,
        parse_mode: 'HTML',
      });
    } catch (photoErr) {
      logger.warn('Failed to send showcase photo, falling back to text message:', { photoErr });
      sentMessage = await bot.telegram.sendMessage(targetChannel, postCard, {
        parse_mode: 'HTML',
        link_preview_options: { is_disabled: false },
      });
    }
  } else {
    sentMessage = await bot.telegram.sendMessage(targetChannel, postCard, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: false },
    });
  }

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
      `Your project <b>${title}</b> has officially been published on the official channel!\n\n` +
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
 * Removes the showcase post from the Telegram channel and resets status to pending/draft
 */
export async function unpublishShowcaseFromChannel(submissionId: number, adminEmail?: string) {
  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { participant: true },
  });

  if (!submission) {
    throw new Error('Project submission not found');
  }

  const channelSetting = await getSetting('TELEGRAM_CHANNEL_ID');
  const targetChannel = (channelSetting || env.TELEGRAM_CHANNEL_ID || '@NilePixelTech').trim();

  // If there is an active message on the channel, delete it via Telegram API
  if (submission.channelMessageId) {
    try {
      await bot.telegram.deleteMessage(targetChannel, submission.channelMessageId);
      logger.info(
        `Successfully deleted message #${submission.channelMessageId} from channel ${targetChannel}`
      );
    } catch (delErr) {
      logger.warn(
        `Failed to delete message #${submission.channelMessageId} from Telegram (may already be deleted):`,
        { delErr }
      );
    }
  }

  // Reset reaction count in DB
  await prisma.projectReaction.updateMany({
    where: { submissionId: submission.id },
    data: { reactionCount: 0 },
  });

  // Update submission in DB
  const updated = await prisma.projectSubmission.update({
    where: { id: submission.id },
    data: {
      channelMessageId: null,
      channelPostUrl: null,
      status: 'pending',
      publishedAt: null,
    },
    include: { participant: true, reactions: true },
  });

  // Log activity
  await prisma.activityLog.create({
    data: {
      adminEmail: adminEmail ?? 'admin',
      participantId: submission.participantId,
      action: 'SHOWCASE_REMOVED_FROM_CHANNEL',
      details: JSON.stringify({ submissionId: submission.id }),
    },
  });

  return updated;
}

/**
 * Automatically updates reactions whenever Telegram fires an aggregated message_reaction_count event.
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

  const existingReactions = await prisma.projectReaction.findMany({
    where: {
      OR: [
        { submissionId: submission.id },
        { participantId: submission.participantId },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  const validCount = Math.max(0, totalCount);

  const reaction = existingReactions.length > 0
    ? await prisma.projectReaction.update({
        where: { id: existingReactions[0].id },
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount: validCount,
          source: 'telegram_channel_auto',
          recordedBy: 'system_auto_sync',
        },
      })
    : await prisma.projectReaction.create({
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount: validCount,
          source: 'telegram_channel_auto',
          recordedBy: 'system_auto_sync',
        },
      });

  if (existingReactions.length > 1) {
    const extraIds = existingReactions.slice(1).map((r) => r.id);
    await prisma.projectReaction.deleteMany({
      where: { id: { in: extraIds } },
    });
  }

  await prisma.activityLog.create({
    data: {
      participantId: submission.participantId,
      action: 'AUTO_SYNC_REACTION_COUNT',
      details: JSON.stringify({
        channelMessageId,
        totalCount: validCount,
        submissionId: submission.id,
        contestantName: submission.participant.firstName,
      }),
    },
  });

  logger.info(
    `✅ Auto-synced reaction count for ${submission.participant.firstName}: ${validCount} reactions (message #${channelMessageId})`
  );

  return reaction;
}

/**
 * Automatically updates reactions whenever Telegram fires an individual user message_reaction event.
 * Computes delta (new_reaction.length - old_reaction.length) and updates current reaction tally.
 */
export async function syncReactionDeltaForMessage(
  channelMessageId: number,
  delta: number,
  userMeta?: { userId?: number; username?: string; firstName?: string }
) {
  if (delta === 0) {
    logger.debug(`Reaction delta is 0 for message #${channelMessageId}; skipping update.`);
    return null;
  }

  const submission = await prisma.projectSubmission.findFirst({
    where: { channelMessageId },
    include: { participant: true },
  });

  if (!submission) {
    logger.debug(`No showcase submission linked to channelMessageId ${channelMessageId}`);
    return null;
  }

  const existingReactions = await prisma.projectReaction.findMany({
    where: {
      OR: [
        { submissionId: submission.id },
        { participantId: submission.participantId },
      ],
    },
    orderBy: { updatedAt: 'desc' },
  });

  const currentCount = existingReactions[0]?.reactionCount ?? 0;
  const newCount = Math.max(0, currentCount + delta);
  const recordedBy = userMeta?.username
    ? `@${userMeta.username}`
    : userMeta?.userId
    ? `tg_${userMeta.userId}`
    : 'system_auto_sync';

  const reaction = existingReactions.length > 0
    ? await prisma.projectReaction.update({
        where: { id: existingReactions[0].id },
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount: newCount,
          source: 'telegram_channel_auto',
          recordedBy,
        },
      })
    : await prisma.projectReaction.create({
        data: {
          submissionId: submission.id,
          participantId: submission.participantId,
          reactionCount: newCount,
          source: 'telegram_channel_auto',
          recordedBy,
        },
      });

  if (existingReactions.length > 1) {
    const extraIds = existingReactions.slice(1).map((r) => r.id);
    await prisma.projectReaction.deleteMany({
      where: { id: { in: extraIds } },
    });
  }

  await prisma.activityLog.create({
    data: {
      participantId: submission.participantId,
      action: 'AUTO_SYNC_REACTION_DELTA',
      details: JSON.stringify({
        channelMessageId,
        delta,
        newReactionCount: newCount,
        submissionId: submission.id,
        userMeta,
        contestantName: submission.participant.firstName,
      }),
    },
  });

  logger.info(
    `✅ Auto-synced reaction delta (${delta > 0 ? '+' : ''}${delta}) for ${submission.participant.firstName}: new total ${newCount} reactions (message #${channelMessageId})`
  );

  return reaction;
}

/**
 * Resolves list of Telegram chat IDs configured to receive admin review alerts.
 */
export async function getAdminTelegramChatIds(): Promise<string[]> {
  const ids: string[] = [];

  try {
    const dbSetting = await getSetting('ADMIN_CHAT_ID');
    if (dbSetting) {
      const split = dbSetting
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      ids.push(...split);
    }
  } catch (err) {
    logger.warn('Error reading ADMIN_CHAT_ID setting:', { err });
  }

  if (env.ADMIN_CHAT_ID) {
    const split = env.ADMIN_CHAT_ID
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    ids.push(...split);
  }

  // Strictly filter for Telegram Group / Supergroup IDs (starts with -)
  // so alerts go ONLY to the official Administrator Group
  const groupIds = ids.filter((id) => id.startsWith('-'));
  if (groupIds.length > 0) {
    return Array.from(new Set(groupIds));
  }

  return Array.from(new Set(ids));
}

/**
 * Notifies all configured admins on Telegram when a new project is submitted.
 * Admins can 1-click [Directly Publish to Channel] or [Ignore / Reject] directly from Telegram!
 */
export async function notifyAdminsOfNewSubmission(submissionId: number): Promise<void> {
  const adminChatIds = await getAdminTelegramChatIds();
  if (adminChatIds.length === 0) {
    logger.info('No admin chat IDs configured for showcase notifications.');
    return;
  }

  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { participant: true },
  });

  if (!submission) return;

  const contestantName = escapeHtml(submission.participant.firstName);
  const contestantHandle = submission.participant.username
    ? `@${escapeHtml(submission.participant.username)}`
    : 'None';
  const title = escapeHtml(submission.projectTitle || 'StarLift Showcase Project');
  const projectUrl = escapeHtml(submission.projectUrl);
  const description = escapeHtml(submission.description);
  const code = escapeHtml(submission.participant.referralCode);

  const adminCard =
    `<b>New Showcase Submission for Review</b>\n\n` +
    `• <b>Contestant:</b> ${contestantName} (${contestantHandle})\n` +
    `• <b>Telegram ID:</b> <code>${submission.participant.telegramId.toString()}</code>\n` +
    `• <b>Referral Code:</b> <code>${code}</code>\n\n` +
    `• <b>Title:</b> <b>${title}</b>\n` +
    `• <b>Demo / Portfolio:</b> <a href="${projectUrl}">${projectUrl}</a>\n\n` +
    `<b>Pitch / Description:</b>\n` +
    `${description}\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Tap an action below to process immediately:</i>`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.callback('Publish to @NilePixelTech', `sub_pub:${submission.id}`)],
    [Markup.button.callback('Reject / Ignore', `sub_ign:${submission.id}`)],
  ]);

  for (const chatId of adminChatIds) {
    try {
      if (submission.imageUrl && submission.imageUrl.trim().length > 0) {
        try {
          await bot.telegram.sendPhoto(chatId, submission.imageUrl.trim(), {
            caption: adminCard,
            parse_mode: 'HTML',
            reply_markup: keyboard.reply_markup,
          });
          continue;
        } catch (photoErr) {
          logger.warn(`Failed to send admin photo to ${chatId}, falling back to text:`, {
            photoErr,
          });
        }
      }

      await bot.telegram.sendMessage(chatId, adminCard, {
        parse_mode: 'HTML',
        reply_markup: keyboard.reply_markup,
        link_preview_options: { is_disabled: false },
      });
    } catch (sendErr) {
      logger.error(`Failed to send showcase review alert to admin chat ${chatId}:`, { sendErr });
    }
  }
}

/**
 * Sends a constructive DM to the contestant when their project is ignored/rejected,
 * informing them to adjust necessary specifications and resubmit.
 */
export async function notifyContestantOfAdjustmentRequired(submissionId: number): Promise<void> {
  const submission = await prisma.projectSubmission.findUnique({
    where: { id: submissionId },
    include: { participant: true },
  });

  if (!submission) return;

  try {
    const contestantTelegramId = submission.participant.telegramId.toString();
    const contestantName = escapeHtml(submission.participant.firstName);
    const projectTitle = escapeHtml(submission.projectTitle || 'Your Project');

    const dmMessage =
      `<b>Project Specification Update Required</b>\n\n` +
      `Hello ${contestantName},\n\n` +
      `Our review committee in the StarLift Administrator Group has reviewed your submission for <b>"${projectTitle}"</b>.\n\n` +
      `<b>Adjustments Needed:</b>\n` +
      `Your project showcase details require adjustments before it can be published to @NilePixelTech (for example: refining your pitch description, ensuring your demo link is accessible, or attaching a clear project screenshot/banner).\n\n` +
      `<b>How to Resubmit:</b>\n` +
      `You can update and resubmit your project specification right now. Tap the button below or send /submit to make the adjustments.\n\n` +
      `If you need guidance, feel free to contact our support team at @NilePixelSupportBot.`;

    await bot.telegram.sendMessage(contestantTelegramId, dmMessage, {
      parse_mode: 'HTML',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('Update Project Details', 'cmd_update_submit')],
        [Markup.button.url('Contact Support (@NilePixelSupportBot)', 'https://t.me/NilePixelSupportBot')],
        [Markup.button.callback('Main Menu', 'cmd_start')],
      ]).reply_markup,
    });

    logger.info(
      `Successfully sent adjustment DM to contestant ${contestantTelegramId} for submission #${submission.id}`
    );
  } catch (dmErr) {
    logger.warn('Failed to send adjustment DM to contestant:', { dmErr });
  }
}


