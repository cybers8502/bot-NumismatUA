'use strict';

const { InlineKeyboard } = require('grammy');
const {
  getPriceHistory,
  getCoinGallery,
  getCoinDetails,
  getCollection,
  addToCollection,
} = require('../api');
const { getAuthToken } = require('../session');
const { withAuth } = require('../withAuth');
const { escapeHtml } = require('../utils');

function formatDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Extract coin title from the inline keyboard of the search results message.
 * The button that was pressed carries both text (title) and callback_data.
 */
function formatCoinDetails(coin) {
  const fields = [
    ['Тип', coin.coinTypes],
    ['Серія', coin.coinSeriesList],
    ['Номінал', coin.coinDenominations],
    ['Матеріал', coin.coinMaterials],
    ['Якість', coin.coinQualities],
    ['Гурт', coin.coinEdges],
    ['Діаметр', coin.coinDiameters],
    ['Тираж (оголош.)', coin.coinMintagesDeclared],
    ['Тираж (факт.)', coin.coinMintagesActual],
    ['Кольоровість', coin.coinColors],
    ['Пакування', coin.coinPackagings],
  ];

  return fields
    .map(([label, tax]) => {
      const names = tax?.nodes?.map((n) => n.name).filter(Boolean) ?? [];
      return names.length ? `${label}: ${names.join(', ')}` : null;
    })
    .filter(Boolean)
    .join('\n');
}

function getCoinNameFromMessage(ctx, coinId) {
  const buttons =
    ctx.callbackQuery.message?.reply_markup?.inline_keyboard?.flat() ?? [];
  const btn = buttons.find((b) => b.callback_data === `coin_${coinId}`);
  return btn?.text || `Монета #${coinId}`;
}

async function handleCoinCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];
  const coinName = getCoinNameFromMessage(ctx, coinId);
  const authToken = getAuthToken(ctx.from.id);

  // --- Price history ---
  let priceText;
  try {
    const history = await getPriceHistory(coinId);
    if (Array.isArray(history) && history.length > 0) {
      const latest = history
        .slice()
        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      priceText = `<b>Остання відома ціна:</b> ${escapeHtml(latest.price)} грн (${formatDate(latest.date)})`;
    } else {
      priceText = '<b>Ціна:</b> невідома';
    }
  } catch (err) {
    console.error(
      '[callbacks] getPriceHistory failed:',
      err.message,
      err.stack,
    );
    priceText = '<b>Ціна:</b> не вдалося отримати';
  }

  // --- Coin details ---
  let detailsText = '';
  try {
    const coin = await getCoinDetails(coinId);
    detailsText = formatCoinDetails(coin);
  } catch (err) {
    console.error('[callbacks] getCoinDetails failed:', err.message);
  }

  // --- Collection status ---
  let collectionText;
  let inCollection = false;
  if (authToken) {
    try {
      const collection = await withAuth(ctx.from.id, getCollection);
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
    } catch (err) {
      console.error(
        '[callbacks] getCollection failed:',
        err.message,
        err.stack,
      );
      collectionText = '📋 Не вдалося перевірити колекцію';
    }
  } else {
    collectionText = '🔐 <a href="/login">Увійдіть</a> щоб бачити колекцію';
  }

  const text =
    `🪙 <b>${escapeHtml(coinName)}</b>\n` +
    `<b>ID:</b> ${coinId}\n\n` +
    `${priceText}\n\n` +
    (detailsText ? `${detailsText}\n\n` : '') +
    `${collectionText}`;

  const keyboard = new InlineKeyboard();
  if (authToken && !inCollection) {
    keyboard.text('➕ Додати до колекції', `add_${coinId}`);
  }
  keyboard.text('🖼 Фото', `gallery_${coinId}`);

  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

async function handleAddCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];
  const authToken = getAuthToken(ctx.from.id);

  if (!authToken) {
    await ctx.reply('⚠️ Спочатку увійдіть в акаунт командою /login');
    return;
  }

  try {
    await withAuth(ctx.from.id, (token) =>
      addToCollection(Number(coinId), token),
    );
  } catch (err) {
    console.error(
      '[callbacks] addToCollection failed:',
      err.message,
      err.stack,
    );
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

async function handleGalleryCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];
  let photos;
  try {
    photos = await getCoinGallery(coinId);
  } catch (err) {
    console.error('[callbacks] getCoinGallery failed:', err.message);
    await ctx.reply('⚠️ Не вдалося завантажити фото.');
    return;
  }

  const urls = photos
    .map((p) => p.medium || p.url)
    .filter(Boolean)
    .slice(0, 2);
  if (!urls.length) {
    await ctx.reply('📷 Фото для цієї монети відсутні.');
    return;
  }

  if (urls.length === 1) {
    await ctx.replyWithPhoto(urls[0]);
    return;
  }

  await ctx.replyWithMediaGroup(
    urls.map((url) => ({ type: 'photo', media: url })),
  );
}

module.exports = {
  handleCoinCallback,
  handleAddCallback,
  handleGalleryCallback,
};
