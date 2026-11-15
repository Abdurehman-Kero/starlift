import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../..', '.env') });

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'contact@nilexpixel.et';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'nexus@0974';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: { passwordHash, updatedAt: new Date() },
    create: {
      email: adminEmail,
      passwordHash,
      name: 'Admin',
      role: 'admin',
      isActive: true,
    },
  });

  console.log(`Admin user seeded: ${adminEmail}`);

  const settings: Array<{
    key: string;
    value: string;
    description: string;
  }> = [
    {
      key: 'CHALLENGE_START_DATE',
      value: '2026-11-15',
      description: 'Challenge start date (YYYY-MM-DD)',
    },
    {
      key: 'CHALLENGE_END_DATE',
      value: '2026-11-30',
      description: 'Challenge end date (YYYY-MM-DD)',
    },
    {
      key: 'REFERRAL_WEIGHT',
      value: '70',
      description: 'Percentage weight for referrals in scoring (0-100)',
    },
    {
      key: 'REACTION_WEIGHT',
      value: '30',
      description: 'Percentage weight for reactions in scoring (0-100)',
    },
    {
      key: 'CAMPAIGN_STATUS',
      value: 'active',
      description: 'Campaign status: active, paused, ended',
    },
    {
      key: 'TELEGRAM_CHANNEL_ID',
      value: process.env.TELEGRAM_CHANNEL_ID || '@NilePixelTech',
      description: 'Telegram channel ID to monitor for joins',
    },
    {
      key: 'MIN_REFERRALS_FOR_ELIGIBILITY',
      value: '1',
      description: 'Minimum referrals needed to be eligible for rewards',
    },
  ];

  for (const setting of settings) {
    await prisma.challengeSettings.upsert({
      where: { key: setting.key },
      update: setting.key === 'TELEGRAM_CHANNEL_ID' && setting.value ? { value: setting.value } : {},
      create: {
        key: setting.key,
        value: setting.value,
        description: setting.description,
      },
    });
  }

  console.log(`Seeded ${settings.length} challenge settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
