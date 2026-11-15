import { Context } from 'telegraf';
import { env } from '../../config/env';
import { getSetting } from '../../services/settings.service';
import { getOrCreateParticipant } from '../../services/participant.service';
import { findParticipantByInviteLink } from '../../services/invitation.service';
import { createReferral } from '../../services/referral.service';
import { prisma } from '../../database/client';
import logger from '../../config/logger';

type ChatMemberUpdate = Context & {
  chatMember?: {
    chat: { id: number };
    new_chat_member: { status: string; user: { id: number; first_name: string; last_name?: string; username?: string } };
    invite_link?: { invite_link: string; name?: string };
  };
};

export function registerChatMemberHandler(bot: {
  on: (event: string, handler: (ctx: ChatMemberUpdate) => Promise<void>) => void;
}) {
  bot.on('chat_member', async (ctx: ChatMemberUpdate) => {
    try {
      const update = ctx.chatMember;
      if (!update) return;

      // Filter to configured channel (from DB settings or env)
      const settingChannelId = await getSetting('TELEGRAM_CHANNEL_ID');
      const channelId = (settingChannelId || env.TELEGRAM_CHANNEL_ID || '').trim();

      const chatIdStr = String(update.chat.id);
      const chatUsername = (update.chat as any)?.username
        ? `@${(update.chat as any).username}`.toLowerCase()
        : '';
      const targetChannelClean = channelId.toLowerCase();

      const isMatchingChannel =
        !channelId ||
        channelId === '-1001234567890' ||
        chatIdStr === channelId ||
        chatIdStr.replace(/^-100/, '') === channelId.replace(/^-100/, '') ||
        (chatUsername && chatUsername === targetChannelClean);

      if (!isMatchingChannel) return;

      const { new_chat_member, invite_link } = update;
      const { status, user } = new_chat_member;

      // Only process new joins
      if (status !== 'member' && status !== 'administrator') return;

      logger.info('New channel member joined', {
        userId: user.id,
        status,
        hasInviteLink: !!invite_link,
      });

      if (!invite_link) {
        logger.info('No invite link in chat_member update, skipping referral tracking');
        return;
      }

      // Register new member as an invited channel member (not a competitor until they /start the bot)
      const telegramId = BigInt(user.id);
      const { participant: newMember, isNew } = await getOrCreateParticipant({
        telegramId,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        isCompetitor: false,
      });

      await prisma.activityLog.create({
        data: {
          participantId: newMember.id,
          action: isNew ? 'CHANNEL_JOIN_NEW' : 'CHANNEL_JOIN_EXISTING',
          details: JSON.stringify({ inviteLink: invite_link.invite_link, status }),
        },
      });

      // Find link owner
      const linkRecord = await findParticipantByInviteLink(invite_link.invite_link);
      if (!linkRecord) {
        logger.warn('Invite link not found in DB', { inviteLink: invite_link.invite_link });
        return;
      }

      const referrer = linkRecord.participant;

      if (referrer.id === newMember.id) {
        logger.warn('Self-join via own link, skipping referral', { participantId: newMember.id });
        return;
      }

      // Create referral
      const referral = await createReferral({
        referrerId: referrer.id,
        referredId: newMember.id,
        invitationLinkId: linkRecord.id,
      });

      if (!referral) {
        logger.info('Referral not created (duplicate or self)', {
          referrerId: referrer.id,
          referredId: newMember.id,
        });
        return;
      }

      logger.info('Referral recorded from channel join', {
        referrerId: referrer.id,
        referredId: newMember.id,
      });

      // Notify referrer
      try {
        const newMemberName = user.username ? `@${user.username}` : user.first_name;
        await ctx.telegram.sendMessage(
          Number(referrer.telegramId),
          `🎉 ${newMemberName} joined via your invite link! You earned a referral point.`
        );
      } catch (notifyErr) {
        logger.warn('Could not notify referrer', { referrerId: referrer.id, notifyErr });
      }
    } catch (error) {
      logger.error('Error in chat_member handler', { error });
    }
  });
}
