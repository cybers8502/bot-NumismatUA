'use strict';

const { getCollection } = require('../api');
const { getAuthToken } = require('../session');
const { withAuth } = require('../withAuth');
const { escapeHtml } = require('../utils');

async function handleCollection(ctx) {
  const authToken = getAuthToken(ctx.from.id);
  if (!authToken) {
    return ctx.reply('🔐 Спочатку увійдіть командою /login');
  }

  let items;
  try {
    items = await withAuth(ctx.from.id, getCollection);
  } catch (err) {
    console.error('[collection] getCollection failed:', err.message);
    return ctx.reply('⚠️ Не вдалося завантажити колекцію. Спробуйте пізніше.');
  }

  if (!items.length) {
    return ctx.reply('Ваша колекція порожня.');
  }

  const lines = items.map(
    (item) =>
      `• <b>${escapeHtml(String(item.coin_id))}</b> — ${item.quantity} шт.${item.paid ? `, сплачено: ${item.paid}` : ''}`,
  );

  await ctx.reply(
    `<b>Ваша колекція (${items.length}):</b>\n\n${lines.join('\n')}`,
    { parse_mode: 'HTML' },
  );
}

module.exports = { handleCollection };
