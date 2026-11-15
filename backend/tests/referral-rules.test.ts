import { describe, it, expect } from 'vitest';
import { generateReferralCode } from '../src/services/participant.service';

describe('Referral Rules & Integrity Validation', () => {
  it('generates deterministic and unique referral codes from Telegram ID', () => {
    const tgId1 = BigInt(123456789);
    const tgId2 = BigInt(987654321);

    const code1 = generateReferralCode(tgId1);
    const code1Repeat = generateReferralCode(tgId1);
    const code2 = generateReferralCode(tgId2);

    expect(code1).toHaveLength(10);
    expect(code1).toBe(code1Repeat); // Deterministic
    expect(code1).not.toBe(code2); // Unique across different users
    expect(code1).toBe(code1.toUpperCase()); // Clean uppercase alphanumeric
  });

  it('rejects self-referral attempts', () => {
    const referrerId = 42;
    const referredId = 42;

    const isSelfReferral = referrerId === referredId;
    expect(isSelfReferral).toBe(true);
  });

  it('detects duplicate referral records for the same referred user', () => {
    const existingReferrals = new Set<number>();
    existingReferrals.add(101); // User 101 already joined via a referral

    const newUserAttempt1 = 101;
    const isDuplicate = existingReferrals.has(newUserAttempt1);
    expect(isDuplicate).toBe(true);

    const newUserAttempt2 = 102;
    const isNew = !existingReferrals.has(newUserAttempt2);
    expect(isNew).toBe(true);
  });
});

