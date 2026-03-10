'use strict';

const { InlineKeyboard } = require('grammy');
const { searchCoins } = require('../api');

function getCoinTitle(coin) {
  return coin.title?.rendered || coin.name || `Монета #${coin.id}`;
}

async function handleSearch(ctx) {
  const query = (ctx.match ?? ctx.message?.text ?? '').trim();

  if (!query) {
    return ctx.reply('Введіть назву монети для пошуку.', {
      parse_mode: 'HTML',
    });
  }

  let coins;
  try {
    coins = await searchCoins(query);
  } catch (err) {
    console.error('[search] searchCoins failed:', err.message, err.stack);
    return ctx.reply('⚠️ Не вдалося підключитися до API. Спробуйте пізніше.');
  }

  if (!Array.isArray(coins) || coins.length === 0) {
    return ctx.reply(
      `Монети за запитом "<b>${escapeHtml(query)}</b>" не знайдено.`,
      {
        parse_mode: 'HTML',
      },
    );
  }

  await ctx.reply(
    `Знайдено <b>${coins.length}</b> монет за запитом "<b>${escapeHtml(query)}</b>":`,
    { parse_mode: 'HTML' },
  );

  for (const coin of coins) {
    const title = getCoinTitle(coin);
    const keyboard = new InlineKeyboard().text(title, `coin_${coin.id}`);
    if (coin.photo) {
      await ctx.replyWithPhoto(coin.photo, {
        caption: title,
        reply_markup: keyboard,
      });
    } else {
      await ctx.reply(title, { reply_markup: keyboard });
    }
  }
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = { handleSearch };
