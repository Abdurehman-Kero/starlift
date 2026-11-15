import { Context, Markup, Telegraf } from 'telegraf';
import { env } from '../../config/env';
import { prisma } from '../../database/client';
import { getSetting, updateSetting } from '../../services/settings.service';
import {
  publishShowcaseToChannel,
  unpublishShowcaseFromChannel,
  getAdminTelegramChatIds,
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
  const userId = ctx.from?.id ? String(ctx.from.id) : '';

  const adminIds = await getAdminTelegramChatIds();
  return adminIds.includes(chatId) || adminIds.includes(userId);
}

export function registerAdminCommand(bot: Telegraf) {
  // 1. /admin <password> - Connect admin chat to receive submissions
  bot.command('admin', async (ctx: Context) => {
    if (!ctx.chat || !ctx.from) return;

    const message = ctx.message;
    let text = '';
    if (message && 'text' in message) {
      text = message.text.trim();
    }

    const parts = text.split(/\s+/);
    const password = parts[1];
    const chatId = String(ctx.chat.id);

    const isAlreadyAdmin = await isAuthorizedAdmin(ctx);

    if (password && password === env.ADMIN_PASSWORD) {
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
          `<i>No need to manually re-type anything on the web admin panel!</i>`
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

  // 2. /setadminchat <password> - Connect a Telegram Group to receive submissions
  bot.command('setadminchat', async (ctx: Context) => {
    if (!ctx.chat) return;

    const message = ctx.message;
    let text = '';
    if (message && 'text' in message) {
      text = message.text.trim();
    }

    const parts = text.split(/\s+/);
    const password = parts[1];
    const chatId = String(ctx.chat.id);

    if (!password || password !== env.ADMIN_PASSWORD) {
      await ctx.replyWithHTML(
        `⚠️ <b>Authorization Failed.</b> Usage: <code>/setadminchat &lt;admin_password&gt;</code>`
      );
      return;
    }

    const current = (await getSetting('ADMIN_CHAT_ID')) || '';
    const ids = current
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.includes(chatId)) {
      ids.push(chatId);
      await updateSetting('ADMIN_CHAT_ID', ids.join(', '), 'telegram_group_admin');
    }

    await ctx.replyWithHTML(
      `✅ <b>Admin Group Registered!</b>\n\n` +
        `All incoming project showcase entries will be posted directly to this group with 1-click <b>[Publish to Channel]</b> and <b>[Ignore]</b> buttons.`
    );
  });

  // 3. Callback Action: Directly Publish to @NilePixelTech
  bot.action(/^sub_pub:(\d+)$/, async (ctx: Context) => {
    const match = (ctx as any).match;
    const submissionId = parseInt(match[1], 10);

    const authorized = await isAuthorizedAdmin(ctx);
    if (!authorized) {
      await ctx.answerCbQuery('⚠️ Unauthorized: You are not registered as an admin.', {
        show_alert: true,
      });
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
        `✅ <b>PUBLISHED TO @NilePixelTech</b>\n\n` +
        `🏷️ <b>Title:</b> ${title}\n` +
        `👨‍💻 <b>Contestant:</b> ${author}\n` +
        `📢 <b>Channel Post:</b> <a href="${postUrl}">${postUrl}</a>\n\n` +
        `<i>Published directly from Telegram by ${adminName} at ${new Date().toLocaleTimeString()}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.url('🚀 View Channel Post', postUrl)],
        [Markup.button.callback('🗑️ Remove from Channel', `sub_unpub:${submissionId}`)],
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
      await ctx.answerCbQuery('⚠️ Unauthorized: You are not registered as an admin.', {
        show_alert: true,
      });
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

      await ctx.answerCbQuery('Submission ignored / rejected.');

      const title = escapeHtml(submission.projectTitle || 'Showcase Project');
      const author = escapeHtml(submission.participant.firstName);

      const updatedText =
        `❌ <b>SUBMISSION REJECTED / IGNORED</b>\n\n` +
        `🏷️ <b>Title:</b> ${title}\n` +
        `👨‍💻 <b>Contestant:</b> ${author}\n\n` +
        `<i>Action taken by ${adminName} at ${new Date().toLocaleTimeString()}</i>`;

      const keyboard = Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Reconsider & Publish to Channel', `sub_pub:${submissionId}`)],
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
      await ctx.answerCbQuery('⚠️ Unauthorized: You are not registered as an admin.', {
        show_alert: true,
      });
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
}
