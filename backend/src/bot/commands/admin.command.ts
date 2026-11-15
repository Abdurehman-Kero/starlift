import { Context, Markup, Telegraf } from 'telegraf';
import { env } from '../../config/env';
import { prisma } from '../../database/client';
import { getSetting, updateSetting } from '../../services/settings.service';
import {
  publishShowcaseToChannel,
  unpublishShowcaseFromChannel,
  getAdminTelegramChatIds,
  notifyContestantOfAdjustmentRequired,
} from '../../services/showcase.service';
import logger from '../../config/logger';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function isAuthorizedAdmin(ctx: Context): Promise<boolean> {
  const chatId = ctx.chat?.id ? String(ctx.chat.id) : '';
  const fromId = ctx.from?.id ? ctx.from.id : null;
  if (!fromId || !chatId) return false;

  const adminIds = await getAdminTelegramChatIds();

  // 1. The action MUST be triggered from inside the registered Administrator Group (negative group ID)!
  const isRegisteredAdminGroup = chatId.startsWith('-') && adminIds.includes(chatId);
  if (!isRegisteredAdminGroup) {
    return false;
  }

  // 2. The user clicking MUST be a member or administrator of this Administrator Group!
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat!.id, fromId);
    const validStatuses = ['creator', 'administrator', 'member'];
    return validStatuses.includes(member.status);
  } catch (err) {
    logger.warn(`Could not verify group membership for user ${fromId} in ${chatId}:`, { err });
    return false;
  }
}

export function registerAdminCommand(bot: Telegraf) {
  // Automatically register group when bot is added to a group/supergroup
  bot.on('my_chat_member', async (ctx: Context) => {
    const chat = ctx.chat;
    if (!chat || chat.type === 'private') return;

    const newStatus = (ctx as any).myChatMember?.new_chat_member?.status;
    const isMemberOrAdmin = ['member', 'administrator'].includes(newStatus);

    if (isMemberOrAdmin) {
      const chatId = String(chat.id);
      const title = 'title' in chat ? chat.title : 'Admin Group';

      try {
        const current = (await getSetting('ADMIN_CHAT_ID')) || '';
        const ids = current
          .split(/[,;\s]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (!ids.includes(chatId)) {
          ids.push(chatId);
          await updateSetting('ADMIN_CHAT_ID', ids.join(', '), 'bot_auto_group_join');
        }

        await ctx.replyWithHTML(
          `🛡️ <b>NilePixel StarLift Administrator Group Connected!</b>\n\n` +
            `Group: <b>${escapeHtml(title)}</b>\n` +
            `Chat ID: <code>${chatId}</code>\n\n` +
            `✅ All incoming contestant project showcase submissions will now be posted directly to this group with instant 1-click <b>[Publish to Channel]</b> and <b>[Ignore]</b> buttons!`
        );
      } catch (err) {
        logger.error('Error auto-registering admin group:', { err });
      }
    }
  });

  // 1. /setadmin, /setadminchat, /adminchat - Quick register command for groups or chats
  bot.command(['setadmin', 'setadminchat', 'adminchat'], async (ctx: Context) => {
    if (!ctx.chat) return;

    const chatId = String(ctx.chat.id);
    const title = 'title' in ctx.chat ? ctx.chat.title : 'Admin Chat';

    try {
      const current = (await getSetting('ADMIN_CHAT_ID')) || '';
      const ids = current
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!ids.includes(chatId)) {
        ids.push(chatId);
        await updateSetting('ADMIN_CHAT_ID', ids.join(', '), 'manual_admin_command');
      }

      await ctx.replyWithHTML(
        `🛡️ <b>Administrator Group Registered!</b>\n\n` +
          `Target: <b>${escapeHtml(title)}</b>\n` +
          `Chat ID: <code>${chatId}</code>\n\n` +
          `✅ <b>Connected:</b> This group will now receive all contestant project submissions with instant 1-click <b>[ 🚀 Directly Publish to @NilePixelTech ]</b> and <b>[ ❌ Ignore / Reject ]</b> buttons!`
      );
    } catch (err) {
      logger.error('Error setting admin chat:', { err });
      await ctx.reply('Failed to register administrator group. Please try again.');
    }
  });

  // 2. /admin <password> - Connect admin chat or check status
  bot.command('admin', async (ctx: Context) => {
    if (!ctx.chat || !ctx.from) return;

    const isGroup = ctx.chat.type === 'group' || ctx.chat.type === 'supergroup';
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from.id);

    // If sent inside a group, immediately register the group!
    if (isGroup) {
      const title = 'title' in ctx.chat ? ctx.chat.title : 'Admin Group';
      const current = (await getSetting('ADMIN_CHAT_ID')) || '';
      const ids = current
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!ids.includes(chatId)) {
        ids.push(chatId);
        await updateSetting('ADMIN_CHAT_ID', ids.join(', '), 'group_admin_cmd');
      }

      await ctx.replyWithHTML(
        `🛡️ <b>Administrator Group Registered!</b>\n\n` +
          `Group: <b>${escapeHtml(title)}</b>\n` +
          `Chat ID: <code>${chatId}</code>\n\n` +
          `✅ All incoming project submissions will be delivered directly here for 1-click review!`
      );
      return;
    }

    const message = ctx.message;
    let text = '';
    if (message && 'text' in message) {
      text = message.text.trim();
    }

    const parts = text.split(/\s+/);
    const password = parts[1];

    const isPrimaryAdmin = userId === '1818017284' || userId === '7448389445';
    const isAlreadyAdmin = await isAuthorizedAdmin(ctx);

    if ((password && password === env.ADMIN_PASSWORD) || isPrimaryAdmin) {
      const current = (await getSetting('ADMIN_CHAT_ID')) || '';
      const ids = current
        .split(/[,;\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!ids.includes(chatId)) {
        ids.push(chatId);
        await updateSetting('ADMIN_CHAT_ID', ids.join(', '), 'telegram_admin');
      }

      await ctx.replyWithHTML(
        `🛡️ <b>Admin Access Confirmed!</b>\n\n` +
          `This chat has been registered to receive live <b>StarLift Project Showcase</b> submissions.\n\n` +
          `Whenever a contestant submits a project via the bot, you will receive an alert here with direct <b>[Publish]</b> and <b>[Ignore]</b> buttons.\n\n` +
          `💡 <i>To receive submissions in an Administrator Group, simply add @NilePixelStarLiftBot to your group and type <code>/setadmin</code>!</i>`
      );
      return;
    }

    if (isAlreadyAdmin) {
      await ctx.replyWithHTML(
        `🛡️ <b>Admin Status: Active</b>\n\n` +
          `This chat is configured to receive submission review alerts with 1-click Publish and Ignore buttons.`
      );
      return;
    }

    await ctx.replyWithHTML(
      `🔒 <b>Admin Authentication Required</b>\n\n` +
        `Please authenticate by sending:\n` +
        `<code>/admin &lt;admin_password&gt;</code>`
    );
  });

  // 3. Callback Action: Directly Publish to @NilePixelTech
  bot.action(/^sub_pub:(\d+)$/, async (ctx: Context) => {
    const match = (ctx as any).match;
    const submissionId = parseInt(match[1], 10);

    const authorized = await isAuthorizedAdmin(ctx);
    if (!authorized) {
      await ctx.answerCbQuery(
        '⚠️ Unauthorized: Only members of the StarLift Administrator Group can approve and publish submissions.',
        { show_alert: true }
      );
      return;
    }

    try {
      await ctx.answerCbQuery('Publishing showcase to @NilePixelTech…');

      const adminName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Admin';
      const published = await publishShowcaseToChannel(submissionId, adminName);

      const title = escapeHtml(published.projectTitle || 'Showcase Project');
      const author = escapeHtml(published.participant.firstName);
      const postUrl = published.channelPostUrl || 'https://t.me/NilePixelTech';

      const updatedText =
        `<b>PUBLISHED TO @NilePixelTech</b>\n\n` +
        `• <b>Title:</b> ${title}\n` +
        `• <b>Contestant:</b> ${author}\n` +
        `• <b>Channel Post:</b> <a href="${postUrl}">${postUrl}</a>\n\n` +
        `<i>Published directly by ${adminName} at ${new Date().toLocaleTimeString()}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('View Channel Post', postUrl)],
        [Markup.button.callback('Remove from Channel', `sub_unpub:${submissionId}`)],
      ]);

      // If original message had photo, edit caption, otherwise edit text
      try {
        await ctx.editMessageCaption(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      } catch (captionErr) {
        await ctx.editMessageText(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
          link_preview_options: { is_disabled: false },
        });
      }
    } catch (err: unknown) {
      logger.error('Error publishing from Telegram callback:', { err });
      const msg = err instanceof Error ? err.message : 'Failed to publish to channel';
      await ctx.answerCbQuery(`❌ Error: ${msg}`, { show_alert: true });
    }
  });

  // 4. Callback Action: Ignore / Reject
  bot.action(/^sub_ign:(\d+)$/, async (ctx: Context) => {
    const match = (ctx as any).match;
    const submissionId = parseInt(match[1], 10);

    const authorized = await isAuthorizedAdmin(ctx);
    if (!authorized) {
      await ctx.answerCbQuery(
        '⚠️ Unauthorized: Only members of the StarLift Administrator Group can ignore or approve submissions.',
        { show_alert: true }
      );
      return;
    }

    try {
      const adminName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Admin';

      const submission = await prisma.projectSubmission.update({
        where: { id: submissionId },
        data: {
          status: 'rejected',
          verifiedAt: new Date(),
          verifiedBy: adminName,
        },
        include: { participant: true },
      });

      // Send immediate, constructive DM to the contestant informing them to adjust and resubmit!
      await notifyContestantOfAdjustmentRequired(submission.id);

      await ctx.answerCbQuery('Submission ignored. Contestant has been notified to adjust and resubmit.');

      const title = escapeHtml(submission.projectTitle || 'Showcase Project');
      const author = escapeHtml(submission.participant.firstName);

      const updatedText =
        `<b>SUBMISSION REJECTED / IGNORED</b>\n\n` +
        `• <b>Title:</b> ${title}\n` +
        `• <b>Contestant:</b> ${author}\n\n` +
        `<i>Action taken by ${adminName} at ${new Date().toLocaleTimeString()}</i>\n` +
        `<i>A direct message was sent to ${author} requesting adjustments and resubmission.</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('Reconsider & Publish to Channel', `sub_pub:${submissionId}`)],
      ]);

      try {
        await ctx.editMessageCaption(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      } catch (captionErr) {
        await ctx.editMessageText(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      }
    } catch (err: unknown) {
      logger.error('Error rejecting from Telegram callback:', { err });
      await ctx.answerCbQuery('Failed to update submission status.', { show_alert: true });
    }
  });

  // 5. Callback Action: Remove from Channel
  bot.action(/^sub_unpub:(\d+)$/, async (ctx: Context) => {
    const match = (ctx as any).match;
    const submissionId = parseInt(match[1], 10);

    const authorized = await isAuthorizedAdmin(ctx);
    if (!authorized) {
      await ctx.answerCbQuery(
        '⚠️ Unauthorized: Only members of the StarLift Administrator Group can approve and publish submissions.',
        { show_alert: true }
      );
      return;
    }

    try {
      const adminName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Admin';
      await unpublishShowcaseFromChannel(submissionId, adminName);

      await ctx.answerCbQuery('Showcase removed from channel.');

      const updatedText =
        `🗑️ <b>REMOVED FROM @NilePixelTech</b>\n\n` +
        `The showcase post was deleted from the channel and status was reset to pending.\n\n` +
        `<i>Action taken by ${adminName} at ${new Date().toLocaleTimeString()}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🚀 Re-Publish to Channel', `sub_pub:${submissionId}`)],
      ]);

      try {
        await ctx.editMessageCaption(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      } catch (captionErr) {
        await ctx.editMessageText(updatedText, {
          parse_mode: 'HTML',
          reply_markup: keyboard.reply_markup,
        });
      }
    } catch (err: unknown) {
      logger.error('Error unpublishing from Telegram callback:', { err });
      await ctx.answerCbQuery('Failed to remove from channel.', { show_alert: true });
    }
  });

  // 6. /reactions or /setreactions <code_or_id> <count> - Manually set reaction count directly from Telegram admin group
  bot.command(['reactions', 'setreactions'], async (ctx: Context) => {
    const authorized = await isAuthorizedAdmin(ctx);
    if (!authorized) {
      await ctx.reply('⚠️ Unauthorized: This command can only be used by admins in the Administrator Group.');
      return;
    }

    const message = ctx.message;
    let text = '';
    if (message && 'text' in message) {
      text = message.text.trim();
    }

    const parts = text.split(/\s+/);
    if (parts.length < 3) {
      await ctx.replyWithHTML(
        `<b>Usage:</b> <code>/reactions &lt;referral_code_or_id&gt; &lt;count&gt;</code>\n\n` +
          `<b>Example:</b> <code>/reactions 8CFA1233E1 25</code> or <code>/reactions 1 50</code>`
      );
      return;
    }

    const identifier = parts[1].trim();
    const count = parseInt(parts[2].trim(), 10);

    if (isNaN(count) || count < 0) {
      await ctx.reply('❌ Please specify a valid non-negative reaction count.');
      return;
    }

    try {
      // Find participant by referral code or by participant ID
      const numId = parseInt(identifier, 10);
      const participant = await prisma.participant.findFirst({
        where: {
          OR: [
            { referralCode: identifier.toUpperCase() },
            ...(isNaN(numId) ? [] : [{ id: numId }]),
          ],
        },
        include: { projectSubmission: true },
      });

      if (!participant) {
        await ctx.reply(`❌ Contestant not found for identifier "${identifier}".`);
        return;
      }

      let submission = participant.projectSubmission;
      if (!submission) {
        submission = await prisma.projectSubmission.create({
          data: {
            participantId: participant.id,
            projectUrl: 'https://t.me/NilePixelTech',
            description: 'Official StarLift showcase project',
            status: 'verified',
          },
        });
      }

      const existingReactions = await prisma.projectReaction.findMany({
        where: {
          OR: [
            { submissionId: submission.id },
            { participantId: participant.id },
          ],
        },
        orderBy: { updatedAt: 'desc' },
      });

      const adminName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || 'Admin';

      if (existingReactions.length > 0) {
        await prisma.projectReaction.update({
          where: { id: existingReactions[0].id },
          data: {
            submissionId: submission.id,
            participantId: participant.id,
            reactionCount: count,
            source: 'telegram_admin_cmd',
            recordedBy: adminName,
          },
        });

        if (existingReactions.length > 1) {
          const extraIds = existingReactions.slice(1).map((r) => r.id);
          await prisma.projectReaction.deleteMany({
            where: { id: { in: extraIds } },
          });
        }
      } else {
        await prisma.projectReaction.create({
          data: {
            submissionId: submission.id,
            participantId: participant.id,
            reactionCount: count,
            source: 'telegram_admin_cmd',
            recordedBy: adminName,
          },
        });
      }

      await prisma.activityLog.create({
        data: {
          adminEmail: adminName,
          participantId: participant.id,
          action: 'UPDATE_REACTION_COUNT_VIA_TG',
          details: JSON.stringify({ count, identifier }),
        },
      });

      const contestantName = escapeHtml(participant.firstName);
      const contestantCode = escapeHtml(participant.referralCode);

      await ctx.replyWithHTML(
        `✅ <b>Reactions Updated Successfully</b>\n\n` +
          `• <b>Contestant:</b> ${contestantName}\n` +
          `• <b>Referral Code:</b> <code>${contestantCode}</code>\n` +
          `• <b>New Reaction Count:</b> <b>${count}</b> reactions\n\n` +
          `Leaderboard rankings and composite scores have been recalculated.`
      );
    } catch (err) {
      logger.error('Error updating reactions via command:', { err });
      await ctx.reply('❌ An error occurred while updating reaction count.');
    }
  });
}
