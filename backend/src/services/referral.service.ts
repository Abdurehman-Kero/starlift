import { prisma } from '../database/client';
import logger from '../config/logger';

interface CreateReferralData {
  referrerId: number;
  referredId: number;
  invitationLinkId?: number;
}

export async function createReferral(data: CreateReferralData) {
  const { referrerId, referredId, invitationLinkId } = data;

  // Prevent self-referral
  if (referrerId === referredId) {
    logger.warn('Self-referral attempt', { referrerId });
    return null;
  }

  // Prevent duplicate referral for the same referred person
  const existing = await prisma.referral.findUnique({
    where: { referredId },
  });
  if (existing) {
    logger.warn('Duplicate referral attempt', { referredId });
    return null;
  }

  const referral = await prisma.referral.create({
    data: {
      referrerId,
      referredId,
      invitationLinkId: invitationLinkId ?? null,
      status: 'confirmed',
    },
    include: { referrer: true, referred: true },
  });

  return referral;
}

export interface ListReferralsOptions {
  page?: number;
  limit?: number;
  referrerId?: number;
  status?: string;
}

export async function listReferrals(options: ListReferralsOptions = {}) {
  const { page = 1, limit = 20, referrerId, status } = options;
  const skip = (page - 1) * limit;

  const where = {
    ...(referrerId ? { referrerId } : {}),
    ...(status ? { status } : {}),
  };

  const [referrals, total] = await Promise.all([
    prisma.referral.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { id: true, telegramId: true, username: true, firstName: true } },
        referred: { select: { id: true, telegramId: true, username: true, firstName: true } },
      },
    }),
    prisma.referral.count({ where }),
  ]);

  return { referrals, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function updateReferralStatus(
  id: number,
  status: string,
  adminEmail: string
) {
  const referral = await prisma.referral.update({
    where: { id },
    data: { status },
  });

  await prisma.activityLog.create({
    data: {
      adminEmail,
      action: 'UPDATE_REFERRAL_STATUS',
      details: JSON.stringify({ referralId: id, newStatus: status }),
    },
  });

  return referral;
}
