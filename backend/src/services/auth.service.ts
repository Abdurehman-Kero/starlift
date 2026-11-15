import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../database/client';
import { env } from '../config/env';
import { AdminUser } from '@prisma/client';

export async function loginAdmin(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin || !admin.isActive) return null;

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return null;

  return admin;
}

export function generateTokens(
  email: string,
  role: string
): { accessToken: string; refreshToken: string } {
  const accessToken = jwt.sign({ email, role }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshToken = jwt.sign({ email, role }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

export function verifyRefreshToken(
  token: string
): { email: string; role: string } | null {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET) as {
      email: string;
      role: string;
    };
    return { email: payload.email, role: payload.role };
  } catch {
    return null;
  }
}
