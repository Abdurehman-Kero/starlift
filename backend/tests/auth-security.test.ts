import { describe, it, expect } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

describe('Admin Authentication & Security Cryptography', () => {
  const secret = 'super-secure-jwt-test-secret-min-32-chars-long';

  it('hashes passwords with bcrypt and verifies correctly', async () => {
    const password = 'SecureAdminPassword2026!';
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);

    expect(hash).not.toBe(password);
    expect(await bcrypt.compare(password, hash)).toBe(true);
    expect(await bcrypt.compare('WrongPassword123', hash)).toBe(false);
  });

  it('signs and verifies JWT access tokens', () => {
    const payload = { email: 'admin@nilepixel.com', role: 'admin' };
    const token = jwt.sign(payload, secret, { expiresIn: '15m' });

    const decoded = jwt.verify(token, secret) as { email: string; role: string };
    expect(decoded.email).toBe('admin@nilepixel.com');
    expect(decoded.role).toBe('admin');
  });

  it('rejects tampered or invalid JWT tokens', () => {
    const payload = { email: 'admin@nilepixel.com', role: 'admin' };
    const token = jwt.sign(payload, secret, { expiresIn: '15m' });

    const tampered = token.slice(0, -5) + 'abcde';
    expect(() => jwt.verify(tampered, secret)).toThrow();
  });
});

