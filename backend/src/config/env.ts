import * as dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';

// Load .env from multiple potential locations
dotenv.config({ path: path.join(__dirname, '../../..', '.env') });
dotenv.config({ path: path.join(__dirname, '../..', '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config();

export const envValidationIssues: string[] = [];

// Auto-generate fallback JWT secrets if not specified
const fallbackJwtSecret = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const fallbackJwtRefreshSecret =
  process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');

if (!process.env.JWT_SECRET) {
  envValidationIssues.push('JWT_SECRET is missing in .env (using auto-generated fallback).');
}
if (!process.env.JWT_REFRESH_SECRET) {
  envValidationIssues.push(
    'JWT_REFRESH_SECRET is missing in .env (using auto-generated fallback).'
  );
}
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('USER:PASSWORD')) {
  envValidationIssues.push(
    'DATABASE_URL is not configured with your actual PostgreSQL credentials in .env.'
  );
}
if (
  !process.env.BOT_TOKEN ||
  process.env.BOT_TOKEN === 'your-telegram-bot-token-here' ||
  process.env.BOT_TOKEN.includes('YOUR_')
) {
  envValidationIssues.push('BOT_TOKEN is not configured with your real Telegram Bot token in .env.');
}

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgresql://postgres:postgres@localhost:5432/nilepixel_starlift?schema=public'),
  JWT_SECRET: z.string().min(32).default(fallbackJwtSecret),
  JWT_REFRESH_SECRET: z.string().min(32).default(fallbackJwtRefreshSecret),
  BOT_TOKEN: z.string().default(''),

  PORT: z
    .string()
    .optional()
    .default('3001')
    .transform((v) => parseInt(v, 10)),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .optional()
    .default('development'),
  JWT_EXPIRES_IN: z.string().optional().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().optional().default('7d'),
  BOT_WEBHOOK_URL: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v : undefined)),
  TELEGRAM_CHANNEL_ID: z
    .string()
    .optional()
    .default('')
    .transform((v) => (v ? v.trim() : '')),
  CORS_ORIGIN: z.string().optional().default('http://localhost:5173'),
  RATE_LIMIT_WINDOW_MS: z
    .string()
    .optional()
    .default('900000')
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_MAX_REQUESTS: z
    .string()
    .optional()
    .default('100')
    .transform((v) => parseInt(v, 10)),
  ADMIN_EMAIL: z.string().optional().default('contact@nilexpixel.et'),
  ADMIN_PASSWORD: z.string().optional().default('nexus@0974'),
  ADMIN_CHAT_ID: z.string().optional().default(''),
});

const parsed = envSchema.safeParse(process.env);

let envData: z.infer<typeof envSchema>;

if (!parsed.success) {
  console.warn('⚠️ Environment variable warnings:');
  console.warn(parsed.error.flatten().fieldErrors);
  envData = envSchema.parse({
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/nilepixel_starlift?schema=public',
    JWT_SECRET: fallbackJwtSecret,
    JWT_REFRESH_SECRET: fallbackJwtRefreshSecret,
    BOT_TOKEN: process.env.BOT_TOKEN || '',
    NODE_ENV: process.env.NODE_ENV || 'development',
  });
} else {
  envData = parsed.data;
}

if (envValidationIssues.length > 0) {
  console.warn('⚠️ NilePixel Backend Configuration Warnings:');
  envValidationIssues.forEach((issue) => console.warn(`   • ${issue}`));
}

export const env = envData;
export type Env = typeof env;
export const isDatabaseConfigured = () =>
  Boolean(env.DATABASE_URL && !env.DATABASE_URL.includes('USER:PASSWORD'));
export const isBotConfigured = () =>
  Boolean(
    env.BOT_TOKEN &&
      env.BOT_TOKEN !== 'your-telegram-bot-token-here' &&
      !env.BOT_TOKEN.includes('YOUR_') &&
      env.BOT_TOKEN.includes(':')
  );
