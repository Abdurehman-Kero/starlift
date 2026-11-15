import { describe, it, expect } from 'vitest';

export function validateTitle(title?: string): { valid: boolean; error?: string } {
  if (!title) return { valid: false, error: 'Title is required' };
  const trimmed = title.trim();
  if (trimmed.length < 2) return { valid: false, error: 'Title must be at least 2 characters' };
  if (trimmed.length > 60) return { valid: false, error: 'Title must be 60 characters or less' };
  return { valid: true };
}

export function validateUrl(rawUrl?: string): { valid: boolean; normalizedUrl?: string; error?: string } {
  if (!rawUrl) return { valid: false, error: 'URL is required' };
  const text = rawUrl.trim();
  if (/\s/.test(text)) return { valid: false, error: 'URL cannot contain spaces' };

  let url = text;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('.')) url = `https://${url}`;
  }

  const urlPattern = /^https?:\/\/[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(:\d+)?(\/.*)?$/;
  if (!urlPattern.test(url) || url.length < 8) {
    return { valid: false, error: 'Invalid URL format' };
  }
  if (url.length > 250) {
    return { valid: false, error: 'URL exceeds 250 characters' };
  }
  return { valid: true, normalizedUrl: url };
}

export function validateDescription(description?: string): { valid: boolean; error?: string } {
  if (!description) return { valid: false, error: 'Description is required' };
  const trimmed = description.trim();
  if (trimmed.length < 20) return { valid: false, error: 'Description must be at least 20 characters' };
  if (trimmed.length > 400) return { valid: false, error: 'Description must be 400 characters or less' };
  return { valid: true };
}

describe('Project Submission Field Validation', () => {
  describe('validateTitle', () => {
    it('rejects title shorter than 2 characters', () => {
      expect(validateTitle('A').valid).toBe(false);
      expect(validateTitle(' ').valid).toBe(false);
      expect(validateTitle('').valid).toBe(false);
    });

    it('rejects title longer than 60 characters', () => {
      const longTitle = 'A'.repeat(61);
      expect(validateTitle(longTitle).valid).toBe(false);
    });

    it('accepts title within 2-60 characters', () => {
      expect(validateTitle('NilePay').valid).toBe(true);
      expect(validateTitle('StarLift Freelancer Portfolio').valid).toBe(true);
      expect(validateTitle('A'.repeat(60)).valid).toBe(true);
    });
  });

  describe('validateUrl', () => {
    it('rejects URLs with spaces', () => {
      expect(validateUrl('https://example.com/some path').valid).toBe(false);
      expect(validateUrl('not a url at all').valid).toBe(false);
    });

    it('rejects URLs shorter than 8 characters', () => {
      expect(validateUrl('http://').valid).toBe(false);
    });

    it('rejects URLs longer than 250 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(240);
      expect(validateUrl(longUrl).valid).toBe(false);
    });

    it('normalizes and accepts valid web URLs', () => {
      expect(validateUrl('https://github.com/nilepixel/starlift').valid).toBe(true);
      expect(validateUrl('http://mysite.et').valid).toBe(true);
      const res = validateUrl('github.com/nilepixel/starlift');
      expect(res.valid).toBe(true);
      expect(res.normalizedUrl).toBe('https://github.com/nilepixel/starlift');
    });
  });

  describe('validateDescription', () => {
    it('rejects short descriptions under 20 characters', () => {
      expect(validateDescription('test').valid).toBe(false);
      expect(validateDescription('Too short').valid).toBe(false);
      expect(validateDescription('1234567890123456789').valid).toBe(false); // 19 chars
    });

    it('rejects long descriptions exceeding 400 characters', () => {
      const longDesc = 'A'.repeat(401);
      expect(validateDescription(longDesc).valid).toBe(false);
    });

    it('accepts descriptions between 20 and 400 characters', () => {
      const validDesc = 'This is a high-speed payment gateway designed for developer-first digital commerce.';
      expect(validateDescription(validDesc).valid).toBe(true);
      expect(validateDescription('A'.repeat(20)).valid).toBe(true);
      expect(validateDescription('A'.repeat(400)).valid).toBe(true);
    });
  });
});
