'use strict';

const { setBlockedStatus } = require('../analytics');

/**
 * Telegram sends `my_chat_member` when a user blocks ('kicked') or
 * unblocks / restarts ('member') the bot. Only private chats matter here —
 * the same update also fires for groups and channels.
 */
async function handleMyChatMember(ctx) {
  if (ctx.chat?.type !== 'private') return;

  const status = ctx.myChatMember.new_chat_member.status;
  if (status === 'kicked') {
    await setBlockedStatus(ctx.from.id, true);
  } else if (status === 'member') {
    await setBlockedStatus(ctx.from.id, false);
  }
}

module.exports = { handleMyChatMember };
