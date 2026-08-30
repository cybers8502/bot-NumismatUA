const { InlineKeyboard } = require('grammy');
const {
  getPriceHistory,
  getPriceStats,
  getCoinGallery,
  getCoinDetails,
  getCollection,
  addToCollection,
} = require('../api');
const { getAuthToken } = require('../session');
const { withAuth } = require('../withAuth');
const { escapeHtml } = require('../utils');
const { buildPriceChartUrl } = require('../chart');
const { logEvent } = require('../analytics');

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
 * Arrow for a priceStats.trend value ('up' | 'down' | 'flat' | null).
 */
function trendArrow(trend) {
  if (trend === 'up') return ' 🔼';
  if (trend === 'down') return ' 🔽';
  return '';
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

  // --- Price stats (latest price + trend, computed server-side) ---
  let priceText;
  try {
    const stats = await getPriceStats(coinId);
    if (stats && stats.latestPrice != null) {
      priceText = `<b>Остання відома ціна:</b> ${escapeHtml(stats.latestPrice)} грн${trendArrow(stats.trend)} (${formatDate(stats.latestDate)})`;
    } else {
      priceText = '<b>Ціна:</b> невідома';
    }
  } catch (err) {
    console.error('[callbacks] getPriceStats failed:', err.message, err.stack);
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
  keyboard.text('📈 Графік ціни', `chart_${coinId}`);

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

  logEvent('add_to_collection', ctx.from.id, { coinId });

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

async function handleChartCallback(ctx) {
  await ctx.answerCallbackQuery();

  const coinId = ctx.match[1];
  let history;
  try {
    history = await getPriceHistory(coinId);
  } catch (err) {
    console.error('[callbacks] getPriceHistory failed:', err.message);
    await ctx.reply('⚠️ Не вдалося завантажити історію цін.');
    return;
  }

  let chartUrl;
  try {
    chartUrl = await buildPriceChartUrl(history);
  } catch (err) {
    console.error('[callbacks] buildPriceChartUrl failed:', err.message);
    await ctx.reply('⚠️ Не вдалося побудувати графік.');
    return;
  }

  if (!chartUrl) {
    await ctx.reply('📈 Замало даних для графіка ціни цієї монети.');
    return;
  }

  // Caption with the same stats a priceStats-driven widget would show
  // (see priceStats in the wp-coins theme) — best-effort, chart still
  // sends without it if this fetch fails.
  let caption;
  try {
    caption = buildChartCaption(await getPriceStats(coinId));
  } catch (err) {
    console.error('[callbacks] getPriceStats failed:', err.message);
  }

  try {
    await ctx.replyWithPhoto(
      chartUrl,
      caption ? { caption, parse_mode: 'HTML' } : undefined,
    );
  } catch (err) {
    // Without this, a rejected photo (bad/expired QuickChart URL, Telegram-side
    // fetch failure, etc.) fell through to the bot-wide bot.catch(), which only
    // logs — the user got no reply at all, with no indication anything failed.
    console.error('[callbacks] replyWithPhoto failed:', err.message);
    await ctx.reply('⚠️ Не вдалося надіслати графік.');
  }
}

function formatPct(pct) {
  if (pct === null || pct === undefined) return null;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

function buildChartCaption(stats) {
  if (!stats || stats.latestPrice == null) return null;

  const lines = [
    `📈 <b>Динаміка ціни</b>`,
    `Зараз: ${escapeHtml(stats.latestPrice)} грн${trendArrow(stats.trend)}`,
  ];

  if (stats.nbuPrice != null) {
    lines.push(`Ціна НБУ (остання відома): ${escapeHtml(stats.nbuPrice)} грн`);
    const vsNbu = formatPct(stats.vsNbuPct);
    if (vsNbu) lines.push(`Ринок до НБУ: ${vsNbu}`);
  }

  const periodPct = formatPct(stats.periodDeltaPct);
  if (periodPct && stats.periodMin != null && stats.periodMax != null) {
    lines.push(
      `За період: ${periodPct} (мін ${escapeHtml(stats.periodMin)} · макс ${escapeHtml(stats.periodMax)})`,
    );
  }

  return lines.join('\n');
}

module.exports = {
  handleCoinCallback,
  handleAddCallback,
  handleGalleryCallback,
  handleChartCallback,
};
