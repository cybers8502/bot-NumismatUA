'use strict';

const { InlineKeyboard } = require('grammy');
const { getPriceHistory, getCollection, addToCollection } = require('../api');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Extract coin title from the inline keyboard of the search results message.
 * The button that was pressed carries both text (title) and callback_data.
 */
function getCoinNameFromMessage(ctx, coinId) {
  const buttons = ctx.callbackQuery.message?.reply_markup?.inline_keyboard?.flat() ?? [];
  const btn = buttons.find((b) => b.callback_data === `coin_${coinId}`);
  return btn?.text || `Монета #${coinId}`;
}

async function handleCoinCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];
  const coinName = getCoinNameFromMessage(ctx, coinId);

  // --- Price history ---
  let priceText;
  try {
    const history = await getPriceHistory(coinId);
    if (Array.isArray(history) && history.length > 0) {
      const latest = history.slice().sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      priceText = `<b>Остання відома ціна:</b> ${escapeHtml(latest.price)} грн (${formatDate(latest.date)})`;
    } else {
      priceText = '<b>Ціна:</b> невідома';
    }
  } catch {
    priceText = '<b>Ціна:</b> не вдалося отримати';
  }

  // --- Collection status ---
  let collectionText;
  let inCollection = false;
  try {
    const collection = await getCollection();
    const entry = Array.isArray(collection)
      ? collection.find((item) => String(item.coin_id) === String(coinId))
      : null;

    if (entry) {
      inCollection = true;
      const qty = entry.quantity ?? 1;
      const paid = entry.paid ?? 0;
      collectionText = `✅ <b>В колекції</b> (кількість: ${qty}, сплачено: ${paid} грн)`;
    } else {
      collectionText = '➕ Не в колекції';
    }
  } catch {
    collectionText = '📋 Не вдалося перевірити колекцію';
  }

  const text =
    `🪙 <b>${escapeHtml(coinName)}</b>\n` +
    `<b>ID:</b> ${coinId}\n\n` +
    `${priceText}\n\n` +
    `${collectionText}`;

  const keyboard = new InlineKeyboard();
  if (!inCollection) {
    keyboard.text('➕ Додати до колекції', `add_${coinId}`);
  }

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

async function handleAddCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];

  try {
    await addToCollection(Number(coinId));
  } catch {
    await ctx.reply('⚠️ Не вдалося додати до колекції. Спробуйте пізніше.');
    return;
  }

  // Edit the coin card message: remove the "Add" button and append success note
  const originalText = ctx.callbackQuery.message?.text || '';
  const updatedText = originalText + '\n\n✅ <b>Додано до колекції!</b>';

  try {
    await ctx.editMessageText(updatedText, {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard(),
    });
  } catch {
    // editMessageText may fail if message is too old; fall back to a new reply
    await ctx.reply('✅ Додано до колекції!');
  }
}

module.exports = { handleCoinCallback, handleAddCallback };