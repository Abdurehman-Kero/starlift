import { prisma } from '../database/client';

export async function getOverviewStats() {
  const [
    totalParticipants,
    totalReferrals,
    participantsWithReferrals,
    recentReferrals,
  ] = await Promise.all([
    prisma.participant.count({ where: { isActive: true } }),
    prisma.referral.count({ where: { status: 'confirmed' } }),
    prisma.referral.groupBy({
      by: ['referrerId'],
      where: { status: 'confirmed' },
      _count: true,
    }),
    prisma.referral.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        referrer: { select: { id: true, username: true, firstName: true } },
        referred: { select: { id: true, username: true, firstName: true } },
      },
    }),
  ]);

  return {
    totalParticipants,
    totalReferrals,
    participantsWithReferrals: participantsWithReferrals.length,
    totalChannelMembers: totalParticipants, // Approximation; use Telegram API for exact count
    recentReferrals,
  };
}

export async function getDailyStats(days = 7) {
  const result: Array<{ date: string; registrations: number; referrals: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);

    const [registrations, referrals] = await Promise.all([
      prisma.participant.count({
        where: { registeredAt: { gte: start, lte: end } },
      }),
      prisma.referral.count({
        where: { createdAt: { gte: start, lte: end } },
      }),
    ]);

    result.push({
      date: start.toISOString().split('T')[0],
      registrations,
      referrals,
    });
  }

  return result;
}
