import crypto from 'crypto';
import { prisma } from '../database/client';
import { Participant, Prisma } from '@prisma/client';

export function generateReferralCode(telegramId: bigint | number | string): string {
  const hash = crypto
    .createHash('sha256')
    .update(String(telegramId))
    .digest('hex');
  return hash.slice(0, 10).toUpperCase();
}

interface CreateParticipantData {
  telegramId: bigint;
  username?: string;
  firstName: string;
  lastName?: string;
}

export async function getOrCreateParticipant(
  data: CreateParticipantData
): Promise<{ participant: Participant; isNew: boolean }> {
  const existing = await prisma.participant.findUnique({
    where: { telegramId: data.telegramId },
  });

  if (existing) {
    // Update name info if changed
    const updated = await prisma.participant.update({
      where: { id: existing.id },
      data: {
        username: data.username ?? existing.username,
        firstName: data.firstName,
        lastName: data.lastName ?? existing.lastName,
      },
    });
    return { participant: updated, isNew: false };
  }

  const referralCode = generateReferralCode(data.telegramId);
  const participant = await prisma.participant.create({
    data: {
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
      referralCode,
    },
  });

  return { participant, isNew: true };
}

export async function getParticipantByTelegramId(telegramId: bigint) {
  return prisma.participant.findUnique({
    where: { telegramId },
    include: {
      invitationLinks: { where: { isActive: true } },
      referralsMade: {
        include: { referred: true },
        orderBy: { createdAt: 'desc' },
      },
      projectSubmission: true,
    },
  });
}

export async function getParticipantByReferralCode(code: string) {
  return prisma.participant.findUnique({ where: { referralCode: code } });
}

export async function getReferralCount(participantId: number): Promise<number> {
  return prisma.referral.count({
    where: { referrerId: participantId, status: 'confirmed' },
  });
}

export interface LeaderboardEntry {
  id: number;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCode: string;
  referralCount: number;
  reactionCount: number;
  rank: number;
}

export async function getLeaderboard(
  limit = 10,
  skip = 0
): Promise<LeaderboardEntry[]> {
  const participants = await prisma.participant.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { referralsMade: { where: { status: 'confirmed' } } } },
      reactions: true,
    },
  });

  const withCounts = participants.map((p) => ({
    id: p.id,
    telegramId: p.telegramId,
    username: p.username,
    firstName: p.firstName,
    lastName: p.lastName,
    referralCode: p.referralCode,
    referralCount: p._count.referralsMade,
    reactionCount: p.reactions.reduce((sum, r) => sum + r.reactionCount, 0),
  }));

  withCounts.sort(
    (a, b) => b.referralCount - a.referralCount || b.reactionCount - a.reactionCount
  );

  return withCounts.slice(skip, skip + limit).map((entry, index) => ({
    ...entry,
    rank: skip + index + 1,
  }));
}

export interface ListParticipantsOptions {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listParticipants(options: ListParticipantsOptions = {}) {
  const { page = 1, limit = 20, search, sortBy = 'registeredAt', sortOrder = 'desc' } =
    options;
  const skip = (page - 1) * limit;

  const where: Prisma.ParticipantWhereInput = search
    ? {
        OR: [
          { username: { contains: search } },
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { referralCode: { contains: search } },
        ],
      }
    : {};

  const allowedSortFields: Record<string, Prisma.ParticipantOrderByWithRelationInput> = {
    registeredAt: { registeredAt: sortOrder },
    firstName: { firstName: sortOrder },
    username: { username: sortOrder },
  };

  const orderBy = allowedSortFields[sortBy] ?? { registeredAt: 'desc' };

  const [participants, total] = await Promise.all([
    prisma.participant.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        _count: { select: { referralsMade: { where: { status: 'confirmed' } } } },
        invitationLinks: { where: { isActive: true }, take: 1 },
        projectSubmission: { select: { status: true, projectUrl: true } },
      },
    }),
    prisma.participant.count({ where }),
  ]);

  return { participants, total, page, limit, totalPages: Math.ceil(total / limit) };
}
