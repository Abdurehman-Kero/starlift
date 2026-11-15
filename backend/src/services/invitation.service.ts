import { prisma } from '../database/client';
import { getSetting } from './settings.service';
import { env } from '../config/env';
import logger from '../config/logger';

async function getBotInstance() {
  const { bot } = await import('../bot/bot');
  return bot;
}

interface SaveInviteLinkData {
  participantId: number;
  inviteLink: string;
  inviteLinkName?: string;
  telegramLinkId?: string;
  expiresAt?: Date;
}

export async function getActiveInviteLink(participantId: number) {
  return prisma.invitationLink.findFirst({
    where: { participantId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getOrCreateParticipantInviteLink(
  participantId: number,
  referralCode: string
) {
  const existing = await getActiveInviteLink(participantId);
  if (existing) {
    return existing;
  }

  // Retrieve configured Channel ID
  const settingChannelId = await getSetting('TELEGRAM_CHANNEL_ID');
  const rawChannelId = (settingChannelId || env.TELEGRAM_CHANNEL_ID || '').trim();

  if (!rawChannelId || rawChannelId === '-1001234567890') {
    logger.warn('Channel ID not configured when generating invite link');
    return null;
  }

  let targetChatId: string | number = rawChannelId;
  if (/^-?\d+$/.test(rawChannelId)) {
    if (!rawChannelId.startsWith('-')) {
      targetChatId = `-100${rawChannelId}`;
    }
    targetChatId = Number(targetChatId);
  } else if (!rawChannelId.startsWith('@') && !rawChannelId.startsWith('https://')) {
    targetChatId = `@${rawChannelId}`;
  }

  const linkName = `StarLift_${referralCode}`.slice(0, 32);

  try {
    const botInstance = await getBotInstance();
    const created = await botInstance.telegram.createChatInviteLink(targetChatId, {
      name: linkName,
      creates_join_request: false,
    });

    const saved = await saveInviteLink({
      participantId,
      inviteLink: created.invite_link,
      inviteLinkName: linkName,
      telegramLinkId: created.name,
    });

    return saved;
  } catch (err) {
    logger.error('Failed to create chat invite link via Telegram API:', { err, participantId });
    return null;
  }
}

export async function saveInviteLink(data: SaveInviteLinkData) {
  return prisma.invitationLink.create({
    data: {
      participantId: data.participantId,
      inviteLink: data.inviteLink,
      inviteLinkName: data.inviteLinkName,
      telegramLinkId: data.telegramLinkId,
      expiresAt: data.expiresAt,
      isActive: true,
    },
  });
}

export async function findParticipantByInviteLink(inviteLink: string) {
  const link = await prisma.invitationLink.findUnique({
    where: { inviteLink },
    include: { participant: true },
  });
  return link ?? null;
}

export async function getInviteLinkByTelegramId(telegramLinkId: string) {
  return prisma.invitationLink.findUnique({
    where: { telegramLinkId },
    include: { participant: true },
  });
}
