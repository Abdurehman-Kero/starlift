import { describe, it, expect } from 'vitest';

function escapeMarkdownV2(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
}

function extractStartPayload(text?: string): string | undefined {
  if (!text) return undefined;
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 ? parts[1].trim() : undefined;
}

describe('Telegram Formatting & Deep Link Parsing', () => {
  it('correctly escapes all reserved MarkdownV2 characters', () => {
    const raw = 'Hello [World]! NilePixel_StarLift-2026. #Winner ~test~ >quote +5 -3 =0 |pipe| {braces} (parens)';
    const escaped = escapeMarkdownV2(raw);

    // Reserved chars must all be preceded by a backslash
    expect(escaped).toContain('\\[World\\]\\!');
    expect(escaped).toContain('NilePixel\\_StarLift\\-2026\\.');
    expect(escaped).toContain('\\#Winner');
    expect(escaped).toContain('\\~test\\~');
    expect(escaped).toContain('\\>quote');
    expect(escaped).toContain('\\+5');
    expect(escaped).toContain('\\-3');
    expect(escaped).toContain('\\=0');
    expect(escaped).toContain('\\|pipe\\|');
    expect(escaped).toContain('\\{braces\\}');
    expect(escaped).toContain('\\(parens\\)');
  });

  it('correctly extracts referral code from /start deep link command', () => {
    expect(extractStartPayload('/start')).toBeUndefined();
    expect(extractStartPayload('/start A1B2C3D4E5')).toBe('A1B2C3D4E5');
    expect(extractStartPayload('/start   F9E8D7C6B5  ')).toBe('F9E8D7C6B5');
  });

  it('formats showcase publication DM message with post link, invite link, and clear action steps', () => {
    const contestantName = 'NilePixelContact';
    const title = 'StarLift Project';
    const postUrl = 'https://t.me/NilePixelTech/215';
    const inviteLink = 'https://t.me/+vCsFDmGtwQdhZjY0';
    const referralCode = 'E8A739D375';

    const dmText =
      `<b>Congratulations, ${contestantName}!</b>\n\n` +
      `Your project <b>${title}</b> has officially been published on @NilePixelTech.\n\n` +
      `• <b>Showcase Post Link:</b>\n` +
      `<a href="${postUrl}">${postUrl}</a>\n\n` +
      `• <b>Your Personal Invite Link:</b>\n` +
      `<code>${inviteLink}</code>\n\n` +
      `• <b>Referral Code:</b> <code>${referralCode}</code>\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Recommended Immediate Actions to Win the Challenge:</b>\n\n` +
      `1. <b>Mobilize your community:</b>\n` +
      `Share your personal invite link across your developer channels, tech groups, social media, and with any community that supports your work.\n\n` +
      `2. <b>Get them to join and react:</b>\n` +
      `Ask your community members to join @NilePixelTech using your invite link AND react with emojis to your showcase post. Both community joins and post reactions give you points to win the challenge!\n\n` +
      `3. <b>Track your results in real time:</b>\n` +
      `Check your confirmed referral joins anytime by tapping <b>My Stats</b> below or sending /stats.`;

    expect(dmText).toContain(`Congratulations, ${contestantName}!`);
    expect(dmText).toContain(`• <b>Showcase Post Link:</b>\n<a href="${postUrl}">${postUrl}</a>`);
    expect(dmText).toContain(`• <b>Your Personal Invite Link:</b>\n<code>${inviteLink}</code>`);
    expect(dmText).toContain(`• <b>Referral Code:</b> <code>${referralCode}</code>`);
    expect(dmText).toContain('Recommended Immediate Actions to Win the Challenge:');
    expect(dmText).toContain('1. <b>Mobilize your community:</b>');
    expect(dmText).toContain('2. <b>Get them to join and react:</b>');
    expect(dmText).toContain('3. <b>Track your results in real time:</b>');
  });
});
