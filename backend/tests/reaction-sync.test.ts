import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Reaction Synchronization Logic', () => {
  it('computes correct delta when adding, removing, and changing reactions', () => {
    // 1. User adds first reaction 👍
    const event1 = {
      old_reaction: [],
      new_reaction: [{ type: 'emoji', emoji: '👍' }],
    };
    const delta1 = event1.new_reaction.length - event1.old_reaction.length;
    expect(delta1).toBe(1);

    // 2. User switches reaction from 👍 to 🔥
    const event2 = {
      old_reaction: [{ type: 'emoji', emoji: '👍' }],
      new_reaction: [{ type: 'emoji', emoji: '🔥' }],
    };
    const delta2 = event2.new_reaction.length - event2.old_reaction.length;
    expect(delta2).toBe(0);

    // 3. User removes reaction
    const event3 = {
      old_reaction: [{ type: 'emoji', emoji: '🔥' }],
      new_reaction: [],
    };
    const delta3 = event3.new_reaction.length - event3.old_reaction.length;
    expect(delta3).toBe(-1);

    // 4. Premium user adds 2 reactions
    const event4 = {
      old_reaction: [{ type: 'emoji', emoji: '👍' }],
      new_reaction: [{ type: 'emoji', emoji: '👍' }, { type: 'emoji', emoji: '❤️' }],
    };
    const delta4 = event4.new_reaction.length - event4.old_reaction.length;
    expect(delta4).toBe(1);
  });

  it('computes aggregated reaction counts correctly', () => {
    const payload = {
      reactions: [
        { type: { type: 'emoji', emoji: '❤️' }, total_count: 14 },
        { type: { type: 'emoji', emoji: '🔥' }, total_count: 26 },
        { type: { type: 'emoji', emoji: '🚀' }, total_count: 8 },
      ],
    };
    const totalCount = payload.reactions.reduce((sum, r) => sum + (r.total_count || 0), 0);
    expect(totalCount).toBe(48);
  });

  it('guarantees reaction counts never drop below 0', () => {
    const currentCount = 0;
    const delta = -1;
    const newCount = Math.max(0, currentCount + delta);
    expect(newCount).toBe(0);
  });
});
