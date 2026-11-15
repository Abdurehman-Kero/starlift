import { describe, it, expect } from 'vitest';

interface ParticipantData {
  id: number;
  referralCount: number;
  reactionCount: number;
}

function calculateWeightedScores(
  participants: ParticipantData[],
  referralWeight = 70,
  reactionWeight = 30
) {
  if (participants.length === 0) return [];

  const maxReferrals = Math.max(...participants.map((p) => p.referralCount), 1);
  const maxReactions = Math.max(...participants.map((p) => p.reactionCount), 1);

  const scored = participants.map((p) => {
    const referralScore = (p.referralCount / maxReferrals) * 100;
    const reactionScore = (p.reactionCount / maxReactions) * 100;
    const finalScore =
      (referralScore * referralWeight) / 100 + (reactionScore * reactionWeight) / 100;

    return {
      id: p.id,
      referralCount: p.referralCount,
      reactionCount: p.reactionCount,
      referralScore: Math.round(referralScore * 100) / 100,
      reactionScore: Math.round(reactionScore * 100) / 100,
      finalScore: Math.round(finalScore * 100) / 100,
    };
  });

  scored.sort((a, b) => b.finalScore - a.finalScore);
  return scored.map((item, idx) => ({ ...item, rank: idx + 1 }));
}

describe('StarLift 70/30 Scoring Formula', () => {
  it('correctly normalizes and weights 70% referrals and 30% reactions', () => {
    const participants: ParticipantData[] = [
      { id: 1, referralCount: 10, reactionCount: 50 }, // Max referrals, half reactions
      { id: 2, referralCount: 5, reactionCount: 100 },  // Half referrals, max reactions
      { id: 3, referralCount: 0, reactionCount: 0 },    // Zero
    ];

    const results = calculateWeightedScores(participants, 70, 30);

    // Participant 1:
    // referralScore = (10/10)*100 = 100. Weighted 70% = 70.
    // reactionScore = (50/100)*100 = 50. Weighted 30% = 15.
    // finalScore = 70 + 15 = 85.
    const p1 = results.find((r) => r.id === 1)!;
    expect(p1.referralScore).toBe(100);
    expect(p1.reactionScore).toBe(50);
    expect(p1.finalScore).toBe(85);

    // Participant 2:
    // referralScore = (5/10)*100 = 50. Weighted 70% = 35.
    // reactionScore = (100/100)*100 = 100. Weighted 30% = 30.
    // finalScore = 35 + 30 = 65.
    const p2 = results.find((r) => r.id === 2)!;
    expect(p2.referralScore).toBe(50);
    expect(p2.reactionScore).toBe(100);
    expect(p2.finalScore).toBe(65);

    // Participant 3:
    const p3 = results.find((r) => r.id === 3)!;
    expect(p3.referralScore).toBe(0);
    expect(p3.reactionScore).toBe(0);
    expect(p3.finalScore).toBe(0);

    // Check ranking
    expect(results[0].id).toBe(1);
    expect(results[0].rank).toBe(1);
    expect(results[1].id).toBe(2);
    expect(results[1].rank).toBe(2);
    expect(results[2].id).toBe(3);
    expect(results[2].rank).toBe(3);
  });

  it('handles edge case when all participants have 0 referrals and 0 reactions', () => {
    const participants: ParticipantData[] = [
      { id: 10, referralCount: 0, reactionCount: 0 },
      { id: 11, referralCount: 0, reactionCount: 0 },
    ];

    const results = calculateWeightedScores(participants, 70, 30);
    expect(results).toHaveLength(2);
    expect(results[0].finalScore).toBe(0);
    expect(results[1].finalScore).toBe(0);
    expect(Number.isNaN(results[0].finalScore)).toBe(false);
  });

  it('correctly adapts when weights are customized by admin', () => {
    const participants: ParticipantData[] = [
      { id: 1, referralCount: 10, reactionCount: 0 },
      { id: 2, referralCount: 0, reactionCount: 10 },
    ];

    // If admin sets 80% referral / 20% reaction
    const results8020 = calculateWeightedScores(participants, 80, 20);
    expect(results8020.find((r) => r.id === 1)!.finalScore).toBe(80);
    expect(results8020.find((r) => r.id === 2)!.finalScore).toBe(20);

    // If admin sets 50% referral / 50% reaction
    const results5050 = calculateWeightedScores(participants, 50, 50);
    expect(results5050.find((r) => r.id === 1)!.finalScore).toBe(50);
    expect(results5050.find((r) => r.id === 2)!.finalScore).toBe(50);
  });
});

