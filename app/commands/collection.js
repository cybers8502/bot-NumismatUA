'use strict';

const { getCollection } = require('../api');

async function handleCollection(ctx) {
  let items;
  try {
    items = await getCollection();
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
    {
      parse_mode: 'HTML',
    },
  );
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { handleCollection };
