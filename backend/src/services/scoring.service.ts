import { prisma } from '../database/client';
import { getSetting } from './settings.service';

export interface ScoreEntry {
  rank: number;
  id: number;
  telegramId: bigint;
  username: string | null;
  firstName: string;
  lastName: string | null;
  referralCode: string;
  referralCount: number;
  reactionCount: number;
  referralScore: number;
  reactionScore: number;
  finalScore: number;
}

export async function calculateScores(): Promise<ScoreEntry[]> {
  const referralWeightStr = await getSetting('REFERRAL_WEIGHT');
  const reactionWeightStr = await getSetting('REACTION_WEIGHT');

  const referralWeight = referralWeightStr ? parseFloat(referralWeightStr) : 70;
  const reactionWeight = reactionWeightStr ? parseFloat(reactionWeightStr) : 30;

  const participants = await prisma.participant.findMany({
    where: { isActive: true },
    include: {
      _count: { select: { referralsMade: { where: { status: 'confirmed' } } } },
      reactions: true,
    },
  });

  if (participants.length === 0) return [];

  const data = participants.map((p) => ({
    id: p.id,
    telegramId: p.telegramId,
    username: p.username,
    firstName: p.firstName,
    lastName: p.lastName,
    referralCode: p.referralCode,
    referralCount: p._count.referralsMade,
    reactionCount: p.reactions.reduce((sum, r) => sum + r.reactionCount, 0),
  }));

  const maxReferrals = Math.max(...data.map((d) => d.referralCount), 1);
  const maxReactions = Math.max(...data.map((d) => d.reactionCount), 1);

  const scored = data.map((entry) => {
    const referralScore = (entry.referralCount / maxReferrals) * 100;
    const reactionScore = (entry.reactionCount / maxReactions) * 100;
    const finalScore =
      (referralScore * referralWeight) / 100 + (reactionScore * reactionWeight) / 100;

    return {
      ...entry,
      referralScore: Math.round(referralScore * 100) / 100,
      reactionScore: Math.round(reactionScore * 100) / 100,
      finalScore: Math.round(finalScore * 100) / 100,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);

  return scored.map((entry, index) => ({ ...entry, rank: index + 1 }));
}
