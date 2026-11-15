import { prisma } from '../database/client';

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
