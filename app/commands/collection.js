'use strict';

const { InlineKeyboard } = require('grammy');
const { getCollection } = require('../api');
const { getAuthToken } = require('../session');
const { withAuth } = require('../withAuth');

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

  // Each row is tappable — same coin_<id> callback the search results use —
  // to open the full coin card (price, details, gallery, chart, and this
  // item's quantity/paid amount, under "✅ В колекції").
  const keyboard = new InlineKeyboard();
  for (const item of items) {
    keyboard.text(item.title, `coin_${item.coin_id}`).row();
  }

  await ctx.reply(`<b>Ваша колекція (${items.length}):</b>`, {
    parse_mode: 'HTML',
    reply_markup: keyboard,
  });
}

module.exports = { handleCollection };
