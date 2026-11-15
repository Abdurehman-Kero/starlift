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
});
