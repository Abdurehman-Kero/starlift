import { prisma } from '../database/client';

export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.challengeSettings.findUnique({ where: { key } });
  return setting?.value ?? null;
}

export async function getSettings() {
  return prisma.challengeSettings.findMany({ orderBy: { key: 'asc' } });
}

export async function updateSetting(
  key: string,
  value: string,
  updatedBy: string
) {
  const setting = await prisma.challengeSettings.upsert({
    where: { key },
    update: { value, updatedBy },
    create: { key, value, updatedBy },
  });

  await prisma.activityLog.create({
    data: {
      adminEmail: updatedBy,
      action: 'UPDATE_SETTING',
      details: JSON.stringify({ key, value }),
    },
  });

  return setting;
}
